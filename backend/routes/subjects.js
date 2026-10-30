const express=require('express');
const db=require('../config/db');
const {auth}=require('../middleware/auth');
const router=express.Router();

router.get('/',async(_,res)=>{
 try{const [r]=await db.query('SELECT * FROM subjects ORDER BY code');res.json(r)}
 catch(e){res.status(500).json({message:e.message})}
});
router.post('/',auth,async(req,res)=>{
 try{
  const name=String(req.body.name||'').trim();
  const code=String(req.body.code||'').trim().toUpperCase();
  if(!name||!code)return res.status(400).json({message:'Subject name and subject code are required.'});
  if(name.length>120)return res.status(400).json({message:'Subject name must be 120 characters or less.'});
  if(code.length>30)return res.status(400).json({message:'Subject code must be 30 characters or less.'});
  const [existing]=await db.query('SELECT id FROM subjects WHERE code=?',[code]);
  if(existing.length)return res.status(409).json({message:'That subject code already exists.'});
  const [r]=await db.query('INSERT INTO subjects(name,code) VALUES(?,?)',[name,code]);
  res.status(201).json({id:r.insertId,name,code});
 }catch(e){res.status(400).json({message:e.message})}
});
router.delete('/:id',auth,async(req,res)=>{
 try{
  const [subject]=await db.query('SELECT id,name,code FROM subjects WHERE id=?',[req.params.id]);
  if(!subject.length)return res.status(404).json({message:'Subject not found.'});
  const [used]=await db.query('SELECT COUNT(*) AS total FROM notes WHERE subject_id=?',[req.params.id]);
  if(Number(used[0].total)>0){
   return res.status(409).json({message:`Cannot delete ${subject[0].code} — ${subject[0].name} because ${used[0].total} study material(s) are using this subject. Delete or move those materials first.`});
  }
  await db.query('DELETE FROM subjects WHERE id=?',[req.params.id]);
  res.json({message:'Subject deleted'});
 }catch(e){res.status(400).json({message:e.message})}
});
module.exports=router;
