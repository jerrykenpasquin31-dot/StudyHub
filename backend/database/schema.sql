CREATE DATABASE IF NOT EXISTS studyhub;
USE studyhub;

CREATE TABLE IF NOT EXISTS users(
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE,
 password VARCHAR(255) NOT NULL,
 role ENUM('student','teacher','admin') DEFAULT 'student',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 profile_pic VARCHAR(255) NULL,
 profile_pic_public_id VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS subjects(
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 code VARCHAR(30) NOT NULL UNIQUE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes(
 id INT AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(200) NOT NULL,
 description TEXT,
 filename VARCHAR(255) NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 subject_id INT NOT NULL,
 tags VARCHAR(500) DEFAULT '',
 user_id INT NOT NULL,
 upvotes INT DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 file_url TEXT NULL,
 cloudinary_public_id VARCHAR(255) NULL,
 ai_summary TEXT NULL,
 ai_summary_generated_at DATETIME NULL,
 FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_votes(
 id INT AUTO_INCREMENT PRIMARY KEY,
 note_id INT NOT NULL,
 user_id INT NOT NULL,
 UNIQUE KEY one_vote(note_id,user_id),
 FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages(
 id INT AUTO_INCREMENT PRIMARY KEY,
 sender_id INT NOT NULL,
 recipient_id INT NOT NULL,
 body TEXT NULL,
 attachment_url TEXT NULL,
 attachment_name VARCHAR(255) NULL,
 attachment_type VARCHAR(100) NULL,
 attachment_size INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 read_at DATETIME NULL,
 INDEX(sender_id),INDEX(recipient_id),
 FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS note_annotations(
 id INT AUTO_INCREMENT PRIMARY KEY,
 note_id INT NOT NULL,
 user_id INT NOT NULL,
 page_number INT NOT NULL DEFAULT 1,
 selected_text TEXT NOT NULL,
 note_text TEXT NULL,
 highlight_color VARCHAR(20) DEFAULT 'yellow',
 sticker VARCHAR(40) DEFAULT 'dino-green',
 position_data JSON NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(note_id), INDEX(user_id),
 FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS personal_stickers(
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 name VARCHAR(80) NOT NULL,
 image_url TEXT NOT NULL,
 public_id VARCHAR(255) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO subjects(name,code) VALUES
('Information Technology','IT'),('Web Development','WEBDEV'),('Database Systems','DB'),('Programming','PROG'),('General Education','GENED');
