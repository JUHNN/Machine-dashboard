const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const session = require('express-session');
const OpenAI = require('openai');

const app = express();
const openai = new OpenAI({
    apiKey: "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"
});

app.set('view engine', 'ejs');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
    secret: 'semiconductor-secret',
    resave: false,
    saveUninitialized: true
}));

const dbAll = (db, query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbRun = (db, query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) { err ? reject(err) : resolve(this) });
});

function getMode(arr) {
    const counts = {};
    let max = 0, mode = null;
    for (let v of arr) {
        if (v == null || v === '') continue;
        counts[v] = (counts[v] || 0) + 1;
        if (counts[v] > max) { max = counts[v]; mode = v; }
    }
    return mode;
}

// Global DB instance for inline editing and saving
let globalDb = new sqlite3.Database(':memory:');

app.get('/', async (req, res) => {
    try {
        const sqlData = fs.readFileSync('sql.sql', 'utf8');
        
        // Re-initialize DB to apply initial SQL script fresh on page load
        globalDb.close();
        globalDb = new sqlite3.Database(':memory:');
        
        globalDb.exec(sqlData, async () => {
            let [equipment, params, sensors, faults, sequences] = await Promise.all([
                dbAll(globalDb, "SELECT * FROM equipment_states"),
                dbAll(globalDb, "SELECT * FROM process_parameters_recipes"),
                dbAll(globalDb, "SELECT * FROM sensor_readings"),
                dbAll(globalDb, "SELECT * FROM fault_events"),
                dbAll(globalDb, "SELECT * FROM wafer_processing_sequences")
            ]);

            // --- DATA CLEANING PIPELINE ---
            
            // 1. Process Parameters
            params = params.filter(r => r.source_record_type !== 'recipe_param');
            const paramValues = {};
            params.forEach(r => {
                if (r.parameter_value != null) {
                    if (!paramValues[r.parameter_name]) paramValues[r.parameter_name] = [];
                    paramValues[r.parameter_name].push(r.parameter_value);
                }
            });
            const paramModes = {};
            for (let p in paramValues) paramModes[p] = getMode(paramValues[p]);

            params.forEach(r => {
                if (!r.unit) {
                    if (r.parameter_name === 'TargetTemp_C') r.unit = 'degC';
                    if (r.parameter_name === 'RampRate_C_per_min') r.unit = 'degC_per_min';
                    if (r.parameter_name === 'Dose_cm2') r.unit = 'cm2';
                }
                if (r.parameter_value == null && paramModes[r.parameter_name]) {
                    r.parameter_value = paramModes[r.parameter_name];
                }
            });

            // 2. Sensor Readings
            sensors.forEach(r => {
                if (!r.unit) {
                    if (r.parameter === 'temperature') r.unit = 'degC';
                    if (r.parameter === 'pressure') r.unit = 'Pa';
                }
            });
            sensors = sensors.filter(r => r.lot_id && r.wafer_id && r.step_name && r.step_seq);

            // 3. Wafer Sequences
            sequences.forEach(r => {
                if (r.result === 'HOLD') r.action = 'CHECK';
                if (!r.action) r.result = 'HOLD';
                else if (r.action === 'RESUME') r.result = 'FAIL';
                else r.result = 'PASS';
                if (!r.slot_id && r.wafer_seq) r.slot_id = ((r.wafer_seq - 1) % 25) + 1;
            });
            sequences = sequences.filter(r => r.lot_id && r.end_ts && r.result);

            res.render('dashboard', { equipment, params, sensors, faults, sequences });
        });
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

// --- NEW: Inline Editing Endpoint ---
app.post('/update-cell', async (req, res) => {
    const { table, pkField, pkValue, targetField, newValue } = req.body;
    
    // Map frontend tab names to actual SQL table names
    const tableMap = {
        'equipment': 'equipment_states',
        'faults': 'fault_events',
        'processes': 'process_parameters_recipes',
        'sensors': 'sensor_readings',
        'wafer': 'wafer_processing_sequences'
    };
    
    const sqlTable = tableMap[table];
    if (!sqlTable) return res.status(400).json({ error: "Invalid table" });

    try {
        await dbRun(globalDb, `UPDATE ${sqlTable} SET ${targetField} = ? WHERE ${pkField} = ?`, [newValue, pkValue]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update database" });
    }
});

// --- NEW: Export to cleaned_sql.sql ---
app.post('/save-sql', async (req, res) => {
    try {
        const tables = [
            'equipment_states', 'process_parameters_recipes', 
            'sensor_readings', 'fault_events', 'wafer_processing_sequences'
        ];
        
        let sqlDump = "-- Cleaned Semiconductor Data Dump\n\n";

        for (let table of tables) {
            const rows = await dbAll(globalDb, `SELECT * FROM ${table}`);
            if (rows.length === 0) continue;
            
            const keys = Object.keys(rows[0]);
            sqlDump += `-- Table: ${table}\n`;
            
            rows.forEach(row => {
                const values = keys.map(k => {
                    if (row[k] === null) return 'NULL';
                    if (typeof row[k] === 'string') return `'${row[k].replace(/'/g, "''")}'`;
                    return row[k];
                });
                sqlDump += `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
            });
            sqlDump += "\n";
        }

        fs.writeFileSync('cleaned_sql.sql', sqlDump);
        res.json({ success: true, message: "Saved to cleaned_sql.sql" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to export SQL" });
    }
});

// Existing AI & Chat Endpoints...
app.post('/analyze-data', async (req, res) => {
    try {
        const { targetTab, data } = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a semiconductor manufacturing expert analyzing specific database tables." },
                { role: "user", content: `Analyze this data from the ${targetTab} table: ${JSON.stringify(data)}. Identify anomalies and provide actionable insights.` }
            ],
        });
        res.json({ analysis: completion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: "Failed to analyze data" });
    }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));