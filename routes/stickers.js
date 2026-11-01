const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const db=require('../config/db');
const {auth}=require('../middleware/auth');
const {configured:cloudConfigured,uploadBuffer,destroy:destroyCloudinary}=require('../config/cloudinary');
const router=express.Router();
const stickerDir=path.join(__dirname,'../uploads/stickers');
fs.mkdirSync(stickerDir,{recursive:true});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024},fileFilter:(_,f,cb)=>{
 const mime=(f.mimetype||'').toLowerCase();
 if(['image/png','image/jpeg','image/webp','image/gif'].includes(mime)) cb(null,true);
 else cb(new Error('Sticker must be a PNG, JPG, WEBP, or GIF image.'));
}});

router.get('/mine',auth,async(req,res)=>{
 try{const [rows]=await db.query('SELECT id,name,image_url,created_at FROM personal_stickers WHERE user_id=? ORDER BY created_at DESC',[req.user.id]);res.json(rows)}
 catch(e){res.status(500).json({message:e.message})}
});

router.post('/',auth,(req,res)=>{
 upload.single('sticker')(req,res,async err=>{
  if(err)return res.status(400).json({message:err.message||'Could not upload sticker.'});
  if(!req.file)return res.status(400).json({message:'Please choose a sticker image.'});
  try{
   const cleanName=String(req.body.name||'My Sticker').trim().slice(0,80)||'My Sticker';
   let imageUrl,publicId=null;
   if(cloudConfigured){
    const publicName='sticker-'+req.user.id+'-'+Date.now();
    const result=await uploadBuffer(req.file.buffer,{folder:'studyhub/stickers',public_id:publicName,resource_type:'image',overwrite:false});
    imageUrl=result.secure_url;publicId=result.public_id;
   }else{
    const ext=path.extname(req.file.originalname||'').toLowerCase()||'.png';
    const filename='sticker-'+req.user.id+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)+ext;
    fs.writeFileSync(path.join(stickerDir,filename),req.file.buffer);
    imageUrl='stickers/'+filename;
   }
   const [r]=await db.query('INSERT INTO personal_stickers(user_id,name,image_url,public_id) VALUES(?,?,?,?)',[req.user.id,cleanName,imageUrl,publicId]);
   const [rows]=await db.query('SELECT id,name,image_url,created_at FROM personal_stickers WHERE id=?',[r.insertId]);
   res.status(201).json(rows[0]);
  }catch(e){res.status(500).json({message:e.message})}
 });
});

router.delete('/:id',auth,async(req,res)=>{
 try{
  const [rows]=await db.query('SELECT image_url,public_id FROM personal_stickers WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if(!rows.length)return res.status(404).json({message:'Sticker not found.'});
  await db.query('UPDATE note_annotations SET sticker=\'dino-green\' WHERE sticker=? AND user_id=?',[`custom:${req.params.id}`,req.user.id]);
  await db.query('DELETE FROM personal_stickers WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if(rows[0].public_id)await destroyCloudinary(rows[0].public_id,'image').catch(()=>{});
  else if(rows[0].image_url&&!/^https?:\/\//i.test(rows[0].image_url))fs.unlink(path.join(__dirname,'../uploads',rows[0].image_url),()=>{});
  res.json({message:'Sticker deleted.'});
 }catch(e){res.status(500).json({message:e.message})}
});
module.exports=router;
