const express=require('express');
const db=require('../config/db');
const {auth,moderator}=require('../middleware/auth');
const router=express.Router();
router.use(auth,moderator);

router.get('/stats',async(_,res)=>{
 try{const [[users]]=await db.query("SELECT COUNT(*) count FROM users WHERE role='student'");const [[teachers]]=await db.query("SELECT COUNT(*) count FROM users WHERE role='teacher'");const [[notes]]=await db.query('SELECT COUNT(*) count FROM notes');res.json({students:users.count,teachers:teachers.count,notes:notes.count})}
 catch(e){res.status(500).json({message:e.message})}
});

router.get('/users',async(req,res)=>{
 try{const [rows]=await db.query("SELECT id,name,email,role,created_at FROM users WHERE role='student' ORDER BY created_at DESC");res.json(rows)}
 catch(e){res.status(500).json({message:e.message})}
});

router.delete('/users/:id',async(req,res)=>{
 try{
  if(req.user.role!=='admin')return res.status(403).json({message:'Only administrators can remove accounts.'});
  const id=Number(req.params.id); const [rows]=await db.query('SELECT id,name,email,role FROM users WHERE id=?',[id]);
  if(!rows.length)return res.status(404).json({message:'Account not found.'});
  if(id===Number(req.user.id))return res.status(400).json({message:'You cannot delete your own account from moderation.'});
  if(req.user.role==='teacher' && rows[0].role!=='student')return res.status(403).json({message:'Teachers can only remove student accounts.'});
  await db.query('DELETE FROM users WHERE id=?',[id]);
  res.json({message:'Account removed.'});
 }catch(e){res.status(400).json({message:e.message})}
});
module.exports=router;
