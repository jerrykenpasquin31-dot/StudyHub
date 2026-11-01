const jwt=require('jsonwebtoken');
const JWT_SECRET=process.env.JWT_SECRET || 'studyhub_secret_2026';
function auth(req,res,next){
 const h=req.headers.authorization;
 if(!h?.startsWith('Bearer ')) return res.status(401).json({message:'Login required'});
 try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next()}
 catch(e){res.status(401).json({message:'Session expired. Please log in again.'})}
}
function admin(req,res,next){
 if(req.user.role!=='admin') return res.status(403).json({message:'Admin access required'});
 next();
}
function moderator(req,res,next){
 if(!['teacher','admin'].includes(req.user.role)) return res.status(403).json({message:'Teacher or admin access required'});
 next();
}
module.exports={auth,admin,moderator};
