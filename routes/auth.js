const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const db=require('../config/db');
const {auth}=require('../middleware/auth');
const {configured: cloudConfigured, uploadBuffer, destroy: destroyCloudinary}=require('../config/cloudinary');
const router=express.Router();
const JWT_SECRET=process.env.JWT_SECRET || 'studyhub_secret_2026';
const uploadDir=path.join(__dirname,'../uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const profileUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(_,f,cb)=>{const ext=path.extname(f.originalname||'').toLowerCase();const mime=(f.mimetype||'').toLowerCase();if(mime.startsWith('image/')||['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tif','.tiff','.svg','.heic','.heif','.avif'].includes(ext))cb(null,true);else cb(new Error('Profile picture must be an image.'))}});
function makeToken(u){return jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},JWT_SECRET,{expiresIn:'7d'})}

router.post('/register',async(req,res)=>{
 try{
  const {name,email,password}=req.body;
  const requestedRole=String(req.body.role||'student').toLowerCase();
  const role=requestedRole==='teacher'?'teacher':'student';
  if(!name||!email||!password||password.length<6)return res.status(400).json({message:'Complete all fields. Password must be at least 6 characters.'});
  const [x]=await db.query('SELECT id FROM users WHERE email=?',[email]);
  if(x.length)return res.status(409).json({message:'Email is already registered.'});
  const hash=await bcrypt.hash(password,10);
  const [r]=await db.query('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',[name,email,hash,role]);
  res.status(201).json({id:r.insertId,role,message:role==='teacher'?'Teacher account created successfully. Please log in.':'Account created successfully.'});
 }catch(e){res.status(500).json({message:e.message})}
});

router.post('/login',async(req,res)=>{
 try{
  const [rows]=await db.query('SELECT * FROM users WHERE email=?',[req.body.email]);
  if(!rows.length||!(await bcrypt.compare(req.body.password,rows[0].password)))return res.status(401).json({message:'Incorrect email or password.'});
  const u=rows[0];
  const token=makeToken(u);
  res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role,profile_pic:u.profile_pic||null}});
 }catch(e){res.status(500).json({message:e.message})}
});


router.patch('/me',auth,async(req,res)=>{
 try{
  const {name,email,password}=req.body;
  const requestedRole=String(req.body.role||'student').toLowerCase();
  const role=requestedRole==='teacher'?'teacher':'student';
  const cleanName=String(name||'').trim();
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!cleanName||!cleanEmail)return res.status(400).json({message:'Name and email are required.'});
  if(password!==undefined && password!=='' && String(password).length<6)return res.status(400).json({message:'New password must be at least 6 characters.'});
  const [existing]=await db.query('SELECT id FROM users WHERE email=? AND id<>?',[cleanEmail,req.user.id]);
  if(existing.length)return res.status(409).json({message:'That email is already in use.'});
  if(password){
   const hash=await bcrypt.hash(String(password),10);
   await db.query('UPDATE users SET name=?, email=?, password=? WHERE id=?',[cleanName,cleanEmail,hash,req.user.id]);
  }else{
   await db.query('UPDATE users SET name=?, email=? WHERE id=?',[cleanName,cleanEmail,req.user.id]);
  }
  const [rows]=await db.query('SELECT id,name,email,role,created_at,profile_pic FROM users WHERE id=?',[req.user.id]);
  const u=rows[0];
  const token=makeToken(u);
  res.json({message:'Profile updated successfully.',token,user:u});
 }catch(e){res.status(500).json({message:e.message})}
});

router.post('/profile-picture',auth,(req,res)=>{
 profileUpload.single('profile_pic')(req,res,async err=>{
  if(err)return res.status(400).json({message:err.message||'Could not upload profile picture.'});
  if(!req.file)return res.status(400).json({message:'Please choose an image.'});
  try{
   const [rows]=await db.query('SELECT profile_pic,profile_pic_public_id FROM users WHERE id=?',[req.user.id]);
   const old=rows[0]||{};
   let profilePic, publicId=null;
   if(cloudConfigured){
    const publicName='avatar-'+req.user.id+'-'+Date.now();
    const result=await uploadBuffer(req.file.buffer,{folder:'studyhub/profiles',public_id:publicName,resource_type:'image',overwrite:true});
    profilePic=result.secure_url; publicId=result.public_id;
   }else{
    profilePic='avatar-'+Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(req.file.originalname||'');
    fs.writeFileSync(path.join(uploadDir,profilePic),req.file.buffer);
   }
   await db.query('UPDATE users SET profile_pic=?,profile_pic_public_id=? WHERE id=?',[profilePic,publicId,req.user.id]);
   if(old.profile_pic_public_id)await destroyCloudinary(old.profile_pic_public_id,'image').catch(()=>{});
   else if(old.profile_pic && !/^https?:\/\//i.test(old.profile_pic))fs.unlink(path.join(uploadDir,old.profile_pic),()=>{});
   const [urows]=await db.query('SELECT id,name,email,role,created_at,profile_pic FROM users WHERE id=?',[req.user.id]);
   const u=urows[0],token=makeToken(u);
   res.json({message:'Profile picture updated successfully.',token,user:u});
  }catch(e){res.status(500).json({message:e.message})}
 });
});

router.delete('/profile-picture',auth,async(req,res)=>{
 try{
  const [rows]=await db.query('SELECT profile_pic,profile_pic_public_id FROM users WHERE id=?',[req.user.id]);
  const old=rows[0]||{};
  await db.query('UPDATE users SET profile_pic=NULL,profile_pic_public_id=NULL WHERE id=?',[req.user.id]);
  if(old.profile_pic_public_id)await destroyCloudinary(old.profile_pic_public_id,'image').catch(()=>{});
  else if(old.profile_pic && !/^https?:\/\//i.test(old.profile_pic))fs.unlink(path.join(uploadDir,old.profile_pic),()=>{});
  const [urows]=await db.query('SELECT id,name,email,role,created_at,profile_pic FROM users WHERE id=?',[req.user.id]);
  const u=urows[0],token=makeToken(u);
  res.json({message:'Profile picture removed.',token,user:u});
 }catch(e){res.status(500).json({message:e.message})}
});

router.get('/me',auth,async(req,res)=>{
 const [rows]=await db.query('SELECT id,name,email,role,created_at,profile_pic FROM users WHERE id=?',[req.user.id]);
 res.json(rows[0]);
});
module.exports=router;
