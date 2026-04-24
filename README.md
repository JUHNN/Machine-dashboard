# Challenge Schema README

## Overview

This schema is a **simplified prototype database design** for semiconductor tool logs.

It is intentionally aligned to the challenge brief and focuses on these 5 categories only:

1. Equipment states  
2. Process parameters and recipes  
3. Sensor readings  
4. Alarms, warnings, and fault events  
5. Wafer processing sequences

The goal is to keep the schema simple enough for:
- parser output testing
- database insertion
- basic querying
- downstream data cleaning
- introductory analytics and visualization

This schema is **not meant to model every possible field** from every vendor log format.  
Instead, it provides a practical structure that can absorb records from JSON, CSV, XML, and later semi-structured logs.

---

## Files

### 1. `challenge_schema_seed.sql`
This SQL file contains:
- table creation statements
- sample seed data
- about **35 rows per table**
- intentionally includes some `NULL` values for data-cleaning practice

### 2. `README_challenge_schema.md`
This file explains the schema design.

---

## SQL Dialect Note

The provided SQL file is written in a **SQLite-friendly** style.

At the top of the script you may see:

```sql
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
```

These are normal for SQLite:
- `PRAGMA foreign_keys = OFF;` temporarily disables foreign key checks
- `BEGIN TRANSACTION;` starts a transaction for bulk inserts

If you are using **MySQL** or **PostgreSQL**, you may need to remove or adapt those lines.

---

## Design Principles

This schema follows a few rules:

### 1. Align to the brief
The schema only keeps the 5 challenge-required categories.

### 2. Keep lineage
Every table includes:
- `file_id`
- `tool_id`
- `source_record_type`
- `source_reference`

This helps trace every row back to:
- which file it came from
- which machine/tool produced it
- which parsed record type created it
- where it came from in the source structure

### 3. Allow imperfect data
Some seeded rows intentionally contain:
- `NULL` values
- missing lot IDs
- missing wafer IDs
- missing units
- missing messages

This is useful because real log data is often incomplete, and you mentioned you may want to do **data cleaning after writing to the DB**.

### 4. Stay challenge-focused
This is a prototype schema, not a full manufacturing execution system.

---

## Table Summary

## 1. `equipment_states`
Stores machine or equipment state transitions.

### Purpose
Use this table for records such as:
- IDLE → SETUP
- SETUP → PROCESSING
- PROCESSING → FAULTED
- FAULTED → STANDBY

### Columns
- `state_id` — primary key
- `file_id` — source file identifier
- `tool_id` — equipment or machine identifier
- `event_ts` — timestamp of the state transition
- `from_state` — previous state
- `to_state` — new state
- `initiated_by` — operator/system that triggered transition
- `message` — optional description
- `fault_reference` — optional related fault ID/reference
- `source_record_type` — parser record type name
- `source_reference` — source path/reference from parser

---

## 2. `process_parameters_recipes`
Stores recipe parameters and process/setpoint values.

### Purpose
Use this table for:
- recipe definition parameters
- process step setpoints
- run-specific parameter values

### Columns
- `param_id` — primary key
- `file_id` — source file identifier
- `tool_id` — equipment or machine identifier
- `recipe_id` — optional recipe identifier
- `step_name` — optional process step name
- `step_seq` — optional process step sequence number
- `parameter_name` — parameter name
- `parameter_value` — parameter value stored as text
- `unit` — optional unit
- `source_record_type` — parser record type name
- `source_reference` — source path/reference from parser

### Why `parameter_value` is text
Different parameters may be:
- numeric
- categorical
- percentages
- scientific notation
- identifiers

Storing as text gives flexibility in the early prototype stage.

---

## 3. `sensor_readings`
Stores raw or near-raw sensor measurements.

### Purpose
Use this table for:
- pressure readings
- temperature readings
- flow readings
- current/beam/chamber readings

### Columns
- `reading_id` — primary key
- `file_id` — source file identifier
- `tool_id` — equipment or machine identifier
- `lot_id` — optional lot identifier
- `wafer_id` — optional wafer identifier
- `step_name` — optional process step name
- `step_seq` — optional process step sequence number
- `sensor_id` — optional sensor identifier
- `parameter` — parameter or measured quantity
- `reading_ts` — timestamp of measurement
- `value` — numeric reading value
- `unit` — optional measurement unit
- `source_record_type` — parser record type name
- `source_reference` — source path/reference from parser

---

## 4. `fault_events`
Stores alarms, warnings, and fault-related records.

### Purpose
Use this table for:
- alarms
- warnings
- tool faults
- wafer-related fault events
- error conditions

### Columns
- `fault_event_id` — primary key
- `file_id` — source file identifier
- `tool_id` — equipment or machine identifier
- `lot_id` — optional lot identifier
- `wafer_id` — optional wafer identifier
- `step_name` — optional process step name
- `step_seq` — optional process step sequence number
- `fault_ts` — timestamp of fault/event
- `fault_code` — fault/alarm code
- `fault_id` — optional fault identifier
- `severity` — severity level such as INFO/WARNING/ERROR/CRITICAL
- `message` — short event message
- `description` — longer description
- `measured_value` — optional observed value
- `expected_value` — optional expected or threshold value
- `unit` — optional unit
- `auto_action` — optional automatic response/action
- `downtime_minutes` — optional downtime duration
- `source_record_type` — parser record type name
- `source_reference` — source path/reference from parser

---

## 5. `wafer_processing_sequences`
Stores wafer movement and process-step execution flow.

### Purpose
Use this table for:
- wafer progression through steps
- wafer-level process start/end information
- step execution traces
- action/result tracking

### Columns
- `sequence_id` — primary key
- `file_id` — source file identifier
- `tool_id` — equipment or machine identifier
- `lot_id` — optional lot identifier
- `wafer_id` — wafer identifier
- `slot_id` — optional slot identifier
- `wafer_seq` — optional wafer sequence number
- `step_name` — optional process step name
- `step_seq` — optional process step sequence number
- `action` — optional action such as START/END
- `start_ts` — optional start timestamp
- `end_ts` — optional end timestamp
- `result` — optional result such as PASS/FAIL/HOLD
- `recipe_id` — optional recipe identifier
- `source_record_type` — parser record type name
- `source_reference` — source path/reference from parser

---

## Relationship Logic

This simplified schema does **not** enforce a complicated foreign-key design.

Instead, tables are linked logically through shared identifiers such as:
- `file_id`
- `tool_id`
- `lot_id`
- `wafer_id`
- `step_name`
- `step_seq`
- `recipe_id`

This makes the early-stage prototype easier to populate while the parser is still evolving.

---

## Why Missing Values Are Included

The seed data intentionally includes some missing fields.

Examples:
- missing `lot_id`
- missing `wafer_id`
- missing `unit`
- missing `message`
- missing `expected_value`
- missing `action`

This is useful for practicing:
- null checking
- imputation strategy design
- filtering incomplete records
- validating mandatory vs optional fields

---

## Suggested Cleaning Tasks

Once the data is inserted, you can practice tasks like:

1. Find rows with missing critical values
2. Standardize units
3. Standardize severity levels
4. Standardize state names
5. Check wafer sequence completeness

---

## Example Analytical Questions

With this schema, you can already answer questions like:
- How many times did each tool enter `FAULTED`?
- Which recipes appear most often?
- What is the average temperature by tool?
- Which fault codes are most common?
- Which wafers failed?
- Which steps take the longest?

---

## Prototype Limitations

This schema is deliberately simplified.

It does **not** yet include:
- strict foreign key relationships between all domain tables
- a fully normalized equipment master table
- run/session tables
- vendor-specific extension tables
- advanced field standardization layer
- semi-structured/unstructured log ingestion outputs

Those can be added later if your challenge scope expands.

---

## Recommended Workflow

1. Finish parsing logs into Python dictionaries  
2. Map parsed records into the 5 challenge tables  
3. Insert into the database  
4. Run data-cleaning checks  
5. Perform analysis and visualization

---

## Final Note

This schema is a **challenge-focused prototype schema**, not a final production schema.

That is intentional.

It is designed to be:
- simple
- understandable
- testable
- compatible with imperfect log data
- useful for early data analysis
