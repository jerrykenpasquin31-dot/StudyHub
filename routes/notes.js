const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const db=require('../config/db');
const {auth}=require('../middleware/auth');
const {configured: cloudConfigured, uploadBuffer, destroy: destroyCloudinary}=require('../config/cloudinary');
const router=express.Router();
const dir=path.join(__dirname,'../uploads');fs.mkdirSync(dir,{recursive:true});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});

function isAllowedFile(file){
 const ext=path.extname(file.originalname||'').toLowerCase();
 const mime=(file.mimetype||'').toLowerCase();
 return ext==='.pdf' || mime==='application/pdf' || mime.startsWith('image/') ||
  ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tif','.tiff','.svg','.heic','.heif','.avif'].includes(ext);
}
function safeName(name){return path.basename(name).replace(/[^a-zA-Z0-9._-]/g,'_')}

router.get('/',async(req,res)=>{
 try{
  const q=(req.query.q||'').trim();
  let sql=`SELECT n.*,s.name subject_name,s.code subject_code,u.name uploader
           FROM notes n JOIN subjects s ON s.id=n.subject_id JOIN users u ON u.id=n.user_id
           WHERE (n.title LIKE ? OR n.description LIKE ? OR n.tags LIKE ? OR s.name LIKE ? OR s.code LIKE ?)`;
  let v=[...Array(5).fill('%'+q+'%')];
  if(req.query.subject){sql+=' AND n.subject_id=?';v.push(req.query.subject)}
  if(req.query.user){sql+=' AND n.user_id=?';v.push(req.query.user)}
  sql+=' ORDER BY n.upvotes DESC,n.created_at DESC';
  const [r]=await db.query(sql,v);res.json(r);
 }catch(e){res.status(500).json({message:e.message})}
});

router.post('/',auth,(req,res)=>{
 upload.single('file')(req,res,async err=>{
  if(err){
   if(err.code==='LIMIT_FILE_SIZE') return res.status(400).json({message:'File is too large. Maximum size is 10 MB.'});
   return res.status(400).json({message:err.message||'Upload failed.'});
  }
  if(!req.file)return res.status(400).json({message:'No file was received. Please choose a PDF or image and try again.'});
  if(!isAllowedFile(req.file))return res.status(400).json({message:'Only PDF or image files are allowed.'});
  try{
   const {title,description,subject_id,tags}=req.body;
   if(!title||!subject_id)return res.status(400).json({message:'Title and subject are required.'});

   let filename, fileUrl=null, publicId=null, storedMime=req.file.mimetype||'application/octet-stream';
   if(cloudConfigured){
    const isPdf=storedMime==='application/pdf'||path.extname(req.file.originalname).toLowerCase()==='.pdf';
    const folder=isPdf?'studyhub/materials/pdf':'studyhub/materials/images';
    const publicName=Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+safeName(path.parse(req.file.originalname).name);
    const result=await uploadBuffer(req.file.buffer,{
      folder,
      public_id:publicName,
      resource_type:isPdf?'raw':'image',
      use_filename:false,
      unique_filename:false,
      overwrite:false,
      context:{uploaded_by:String(req.user.id),original_name:req.file.originalname}
    });
    filename=result.public_id;
    fileUrl=result.secure_url;
    publicId=result.public_id;
   }else{
    filename=Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(req.file.originalname||'');
    fs.writeFileSync(path.join(dir,filename),req.file.buffer);
   }

   const [r]=await db.query(`INSERT INTO notes(title,description,filename,original_name,mime_type,subject_id,tags,user_id,file_url,cloudinary_public_id) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [title,description||'',filename,req.file.originalname,storedMime,subject_id,tags||'',req.user.id,fileUrl,publicId]);
   res.status(201).json({id:r.insertId,message:'Study material uploaded.',file_url:fileUrl});
  }catch(e){res.status(500).json({message:e.message})}
 });
});

router.post('/:id/upvote',auth,async(req,res)=>{
 try{
  const [v]=await db.query('SELECT id FROM note_votes WHERE note_id=? AND user_id=?',[req.params.id,req.user.id]);
  if(v.length)return res.status(409).json({message:'You already upvoted this material.'});
  await db.query('INSERT INTO note_votes(note_id,user_id) VALUES(?,?)',[req.params.id,req.user.id]);
  await db.query('UPDATE notes SET upvotes=upvotes+1 WHERE id=?',[req.params.id]);
  res.json({message:'Upvoted'});
 }catch(e){res.status(500).json({message:e.message})}
});

router.delete('/:id',auth,async(req,res)=>{
 try{
  const [r]=await db.query('SELECT * FROM notes WHERE id=?',[req.params.id]);
  if(!r.length)return res.status(404).json({message:'Material not found'});
  if(req.user.role==='teacher')return res.status(403).json({message:'Teachers cannot delete study materials. Only administrators can remove materials for moderation.'});
  if(r[0].user_id!==req.user.id&&req.user.role!=='admin')return res.status(403).json({message:'Only the uploader or an administrator can remove this material.'});
  await db.query('DELETE FROM notes WHERE id=?',[req.params.id]);
  if(r[0].cloudinary_public_id){
    const type=(r[0].mime_type||'').startsWith('image/')?'image':'raw';
    await destroyCloudinary(r[0].cloudinary_public_id,type).catch(()=>{});
  }else if(r[0].filename){fs.unlink(path.join(dir,r[0].filename),()=>{});}
  res.json({message:'Material deleted'});
 }catch(e){res.status(500).json({message:e.message})}
});
module.exports=router;
