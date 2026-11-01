require('dotenv').config();
const express=require('express'),cors=require('cors'),path=require('path');
const app=express();
(async()=>{try{const db=require('./config/db'); await db.query(`CREATE TABLE IF NOT EXISTS note_annotations(id INT AUTO_INCREMENT PRIMARY KEY,note_id INT NOT NULL,user_id INT NOT NULL,page_number INT NOT NULL DEFAULT 1,selected_text TEXT NOT NULL,note_text TEXT NULL,highlight_color VARCHAR(20) DEFAULT 'yellow',sticker VARCHAR(40) DEFAULT 'dino-green',position_data JSON NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX(note_id),INDEX(user_id),FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);}catch(e){console.error('Annotation setup:',e.message)}})();
app.use(cors());app.use(express.json());app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
// Add profile picture support to existing databases automatically.
(async()=>{try{const db=require('./config/db'); await db.query("ALTER TABLE users MODIFY role ENUM('student','teacher','admin') DEFAULT 'student'"); const [cols]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='profile_pic'"); if(!cols.length) await db.query("ALTER TABLE users ADD COLUMN profile_pic VARCHAR(255) NULL");
 const [pc]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='profile_pic_public_id'"); if(!pc.length) await db.query("ALTER TABLE users ADD COLUMN profile_pic_public_id VARCHAR(255) NULL");
 const [fc]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notes' AND COLUMN_NAME='file_url'"); if(!fc.length) await db.query("ALTER TABLE notes ADD COLUMN file_url TEXT NULL");
 const [fp]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notes' AND COLUMN_NAME='cloudinary_public_id'"); if(!fp.length) await db.query("ALTER TABLE notes ADD COLUMN cloudinary_public_id VARCHAR(255) NULL");
 const [as]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notes' AND COLUMN_NAME='ai_summary'"); if(!as.length) await db.query("ALTER TABLE notes ADD COLUMN ai_summary LONGTEXT NULL");
 const [ag]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notes' AND COLUMN_NAME='ai_summary_generated_at'"); if(!ag.length) await db.query("ALTER TABLE notes ADD COLUMN ai_summary_generated_at DATETIME NULL");
 const [mc]=await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='messages'"); if(!mc.length) await db.query("CREATE TABLE messages(id INT AUTO_INCREMENT PRIMARY KEY,sender_id INT NOT NULL,recipient_id INT NOT NULL,body TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,read_at DATETIME NULL,INDEX(sender_id),INDEX(recipient_id),FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE)"); const [mb]=await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='messages' AND COLUMN_NAME='attachment_url'"); if(!mb.length){ await db.query("ALTER TABLE messages MODIFY body TEXT NULL"); await db.query("ALTER TABLE messages ADD COLUMN attachment_url TEXT NULL"); await db.query("ALTER TABLE messages ADD COLUMN attachment_name VARCHAR(255) NULL"); await db.query("ALTER TABLE messages ADD COLUMN attachment_type VARCHAR(100) NULL"); await db.query("ALTER TABLE messages ADD COLUMN attachment_size INT NULL"); } const [psc]=await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='personal_stickers'"); if(!psc.length) await db.query("CREATE TABLE personal_stickers(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,name VARCHAR(80) NOT NULL,image_url TEXT NOT NULL,public_id VARCHAR(255) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(user_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)");}catch(e){console.error('Profile picture setup:',e.message)}})();
app.use('/api/auth',require('./routes/auth'));
app.use('/api/subjects',require('./routes/subjects'));
app.use('/api/notes',require('./routes/notes'));
app.use('/api/admin',require('./routes/admin'));
app.use('/api/moderation',require('./routes/moderation'));
app.use('/api/chat',require('./routes/chat'));
app.use('/api/annotations',require('./routes/annotations'));
app.use('/api/stickers',require('./routes/stickers'));
app.use('/api/ai',require('./routes/ai'));
const frontendPath = path.join(__dirname, 'frontend');

app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
app.listen(process.env.PORT||5000,()=>console.log('StudyHub: http://localhost:'+(process.env.PORT||5000)));
