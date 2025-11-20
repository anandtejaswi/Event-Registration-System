CREATE DATABASE EVENTRACK;
USE EVENTRACK;

-- Drop tables if they already exist, in reverse order of creation
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS Schedule;
DROP TABLE IF EXISTS Registrations;
DROP TABLE IF EXISTS Sponsor;
DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS Venues;
DROP TABLE IF EXISTS Event_Type;
DROP TABLE IF EXISTS User;

-- Create User Table
CREATE TABLE User (
    UID INT AUTO_INCREMENT PRIMARY KEY,
    uname VARCHAR(50) NOT NULL,
    udob DATE,
    uaddress VARCHAR(300),
    ustate VARCHAR(50),
    uphone VARCHAR(20),
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Storing plain text passwords is very insecure. Use hashing in a real app.
    user_role ENUM('audience', 'organizer', 'volunteer') NOT NULL
);

-- Create Event_Type Table
CREATE TABLE Event_Type (
    et_id INT AUTO_INCREMENT PRIMARY KEY,
    event_type_name VARCHAR(50) NOT NULL
);

-- Create Venues Table
CREATE TABLE Venues (
    vid INT AUTO_INCREMENT PRIMARY KEY,
    vcountry VARCHAR(50),
    vstate VARCHAR(50),
    vdistrict VARCHAR(50),
    vaddress VARCHAR(300),
    vpincode INT,
    vcapacity INT,
    v_fee INT,
    v_type ENUM('Indoor', 'Outdoor')
);

-- Create Events Table
CREATE TABLE Events (
    eid INT AUTO_INCREMENT PRIMARY KEY,
    ename VARCHAR(50) NOT NULL,
    edate DATE NOT NULL,
    etime TIME NOT NULL,
    vid INT,
    et_id INT,
    eprice INT DEFAULT 0,
    evolunteers_no INT DEFAULT 0,
    oid INT, -- Organizer ID
    FOREIGN KEY (vid) REFERENCES Venues(vid),
    FOREIGN KEY (et_id) REFERENCES Event_Type(et_id),
    FOREIGN KEY (oid) REFERENCES User(UID)
);

-- Create Sponsor Table
CREATE TABLE Sponsor (
    SpID INT AUTO_INCREMENT PRIMARY KEY,
    SpName VARCHAR(100),
    SpEmail VARCHAR(100),
    SpContact VARCHAR(20),
    spcompanyname VARCHAR(100),
    sptype VARCHAR(50),
    spmoney INT,
    eid INT,
    FOREIGN KEY (eid) REFERENCES Events(eid)
);

-- Create Registrations Table
-- This one table handles audience and volunteers
CREATE TABLE Registrations (
    RegID INT AUTO_INCREMENT PRIMARY KEY,
    UID INT,
    EID INT,
    reg_date DATE,
    vRole VARCHAR(50) DEFAULT NULL, -- Only filled if user_role was 'volunteer'
    FOREIGN KEY (UID) REFERENCES User(UID),
    FOREIGN KEY (EID) REFERENCES Events(EID)
);

-- Create Schedule Table
CREATE TABLE Schedule (
    ScID INT AUTO_INCREMENT PRIMARY KEY,
    eid INT,
    sctimestamp TIME,
    scaction VARCHAR(100),
    FOREIGN KEY (eid) REFERENCES Events(eid)
);

-- Create Payment Table
CREATE TABLE Payment (
    PID INT AUTO_INCREMENT PRIMARY KEY,
    UID INT,
    EID INT,
    Mode_of_Payment VARCHAR(20),
    Amount INT NOT NULL,
    TransactionID VARCHAR(50) UNIQUE NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UID) REFERENCES User(UID),
    FOREIGN KEY (EID) REFERENCES Events(EID)
);

-- Insert some dummy data to get started
INSERT INTO Event_Type (event_type_name) VALUES ('Music Concert'), ('Tech Conference'), ('Workshop');
INSERT INTO Venues (vcountry, vstate, vaddress, vcapacity, v_fee, v_type) VALUES ('USA', 'California', '123 Tech Way', 500, 2000, 'Indoor');
INSERT INTO User (uname, email, username, password, user_role) VALUES ('Test Organizer', 'org@test.com', 'org1', 'pass123', 'organizer');
INSERT INTO User (uname, email, username, password, user_role) VALUES ('Test Audience', 'aud@test.com', 'aud1', 'pass123', 'audience');