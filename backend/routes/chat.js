const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const db=require('../config/db');
const {configured:cloudConfigured,uploadBuffer}=require('../config/cloudinary');
const {auth}=require('../middleware/auth');
const router=express.Router();
router.use(auth);
const chatDir=path.join(__dirname,'../uploads/chat');
fs.mkdirSync(chatDir,{recursive:true});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024},fileFilter:(_,f,cb)=>{
 const mime=(f.mimetype||'').toLowerCase();
 if(['application/pdf','image/png','image/jpeg','image/webp','image/gif'].includes(mime)) cb(null,true);
 else cb(new Error('Only PDF, PNG, JPG, WEBP, or GIF files can be sent.'));
}});

router.get('/users',async(req,res)=>{
 try{
  const q=String(req.query.q||'').trim();
  const like='%'+q+'%';
  const [rows]=await db.query(`SELECT id,name,email,role,profile_pic FROM users WHERE id<>? AND (name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 30`,[req.user.id,like,like]);
  res.json(rows);
 }catch(e){res.status(500).json({message:e.message})}
});

router.get('/conversations',async(req,res)=>{
 try{
  const [rows]=await db.query(`
   SELECT u.id,u.name,u.email,u.role,u.profile_pic,
          m.body AS last_message,m.attachment_name,m.attachment_type,m.created_at AS last_message_at,
          (SELECT COUNT(*) FROM messages x WHERE x.sender_id=u.id AND x.recipient_id=? AND x.read_at IS NULL) unread
   FROM users u
   JOIN messages m ON m.id=(SELECT MAX(x.id) FROM messages x WHERE (x.sender_id=? AND x.recipient_id=u.id) OR (x.sender_id=u.id AND x.recipient_id=?))
   WHERE u.id<>?
   ORDER BY m.created_at DESC`,[req.user.id,req.user.id,req.user.id,req.user.id]);
  res.json(rows);
 }catch(e){res.status(500).json({message:e.message})}
});

router.get('/:userId',async(req,res)=>{
 try{
  const other=Number(req.params.userId);
  if(!other||other===Number(req.user.id))return res.status(400).json({message:'Invalid conversation.'});
  const [u]=await db.query('SELECT id,name,email,role,profile_pic FROM users WHERE id=?',[other]);
  if(!u.length)return res.status(404).json({message:'User not found.'});
  const [rows]=await db.query(`SELECT m.id,m.sender_id,m.recipient_id,m.body,m.attachment_url,m.attachment_name,m.attachment_type,m.attachment_size,m.created_at,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?) ORDER BY m.created_at ASC LIMIT 300`,[req.user.id,other,other,req.user.id]);
  await db.query('UPDATE messages SET read_at=NOW() WHERE sender_id=? AND recipient_id=? AND read_at IS NULL',[other,req.user.id]);
  res.json({user:u[0],messages:rows});
 }catch(e){res.status(500).json({message:e.message})}
});

router.post('/:userId',(req,res)=>{
 upload.single('attachment')(req,res,async err=>{
  if(err)return res.status(400).json({message:err.message||'Could not send attachment.'});
  try{
   const other=Number(req.params.userId), body=String(req.body.body||'').trim();
   if(!other||other===Number(req.user.id))return res.status(400).json({message:'Invalid recipient.'});
   if(body.length>2000)return res.status(400).json({message:'Message is too long. Maximum 2,000 characters.'});
   if(!body && !req.file)return res.status(400).json({message:'Write a message or attach a picture/PDF.'});
   const [u]=await db.query('SELECT id FROM users WHERE id=?',[other]);
   if(!u.length)return res.status(404).json({message:'Recipient not found.'});
   let attachmentUrl=null,attachmentName=null,attachmentType=null,attachmentSize=null;
   if(req.file){
    attachmentName=String(req.file.originalname||'attachment').slice(0,255);
    attachmentType=req.file.mimetype;
    attachmentSize=req.file.size;
    if(cloudConfigured){
     const publicName='chat-'+req.user.id+'-'+Date.now()+'-'+Math.random().toString(36).slice(2);
     const result=await uploadBuffer(req.file.buffer,{folder:'studyhub/chat',public_id:publicName,resource_type:'auto',overwrite:false});
     attachmentUrl=result.secure_url;
    }else{
     const ext=path.extname(req.file.originalname||'').toLowerCase()||'.bin';
     const filename='chat-'+req.user.id+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)+ext;
     fs.writeFileSync(path.join(chatDir,filename),req.file.buffer);
     attachmentUrl='chat/'+filename;
    }
   }
   const [r]=await db.query('INSERT INTO messages(sender_id,recipient_id,body,attachment_url,attachment_name,attachment_type,attachment_size) VALUES(?,?,?,?,?,?,?)',[req.user.id,other,body||null,attachmentUrl,attachmentName,attachmentType,attachmentSize]);
   const [rows]=await db.query('SELECT id,sender_id,recipient_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at FROM messages WHERE id=?',[r.insertId]);
   res.status(201).json(rows[0]);
  }catch(e){res.status(500).json({message:e.message})}
 });
});
module.exports=router;
