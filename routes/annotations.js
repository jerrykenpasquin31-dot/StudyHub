const express=require('express');
const db=require('../config/db');
const {auth}=require('../middleware/auth');
const router=express.Router();

router.get('/note/:noteId',auth,async(req,res)=>{
 try{
  const [rows]=await db.query(`SELECT a.*,u.name user_name FROM note_annotations a JOIN users u ON u.id=a.user_id WHERE a.note_id=? AND a.user_id=? ORDER BY a.page_number,a.created_at`,[req.params.noteId,req.user.id]);
  res.json(rows);
 }catch(e){res.status(500).json({message:e.message})}
});

router.post('/',auth,async(req,res)=>{
 try{
  const {note_id,page_number,selected_text,note_text,highlight_color,sticker,position_data}=req.body;
  if(!note_id||!page_number||!selected_text) return res.status(400).json({message:'Please select text in the reviewer first.'});
  const [notes]=await db.query('SELECT id FROM notes WHERE id=?',[note_id]);
  if(!notes.length)return res.status(404).json({message:'Study material not found.'});
  const [r]=await db.query(`INSERT INTO note_annotations(note_id,user_id,page_number,selected_text,note_text,highlight_color,sticker,position_data) VALUES(?,?,?,?,?,?,?,?)`,[note_id,req.user.id,page_number,String(selected_text).slice(0,5000),note_text||'',highlight_color||'yellow',sticker||'dino-green',position_data?JSON.stringify(position_data):null]);
  const [rows]=await db.query('SELECT * FROM note_annotations WHERE id=?',[r.insertId]);
  res.status(201).json(rows[0]);
 }catch(e){res.status(500).json({message:e.message})}
});

router.put('/:id',auth,async(req,res)=>{
 try{
  const {note_text,highlight_color,sticker}=req.body;
  const [r]=await db.query('UPDATE note_annotations SET note_text=?,highlight_color=?,sticker=? WHERE id=? AND user_id=?',[note_text||'',highlight_color||'yellow',sticker||'dino-green',req.params.id,req.user.id]);
  if(!r.affectedRows)return res.status(404).json({message:'Your highlight was not found.'});
  const [rows]=await db.query('SELECT * FROM note_annotations WHERE id=?',[req.params.id]); res.json(rows[0]);
 }catch(e){res.status(500).json({message:e.message})}
});

router.delete('/:id',auth,async(req,res)=>{
 try{const [r]=await db.query('DELETE FROM note_annotations WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!r.affectedRows)return res.status(404).json({message:'Your highlight was not found.'});res.json({message:'Highlight removed.'})}catch(e){res.status(500).json({message:e.message})}
});
module.exports=router;
