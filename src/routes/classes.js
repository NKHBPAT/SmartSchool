// ============================================================
// routes/classes.js
// ============================================================
'use strict';
const express = require('express');
const r = express.Router();
const { query } = require('../config/database');
const { sameSchool } = require('../middleware/auth');
r.get('/', sameSchool, async (req, res, next) => { try { const p=[];let s='SELECT * FROM classes WHERE true'; if(req.schoolId){s+=' AND school_id=$1';p.push(req.schoolId);}s+=' ORDER BY name';const{rows}=await query(s,p);res.json(rows);}catch(e){next(e);}});
r.get('/:id',async(req,res,next)=>{try{const{rows}=await query('SELECT * FROM classes WHERE id=$1',[req.params.id]);if(!rows.length)return res.status(404).json({error:'Classe non trouvée'});res.json(rows[0]);}catch(e){next(e);}});
r.post('/',async(req,res,next)=>{try{const{name,level,school_id,teacher_id}=req.body;if(!name)return res.status(400).json({error:'Nom requis'});const sid=req.user.role!=='admin'?req.user.school_id:school_id;const{rows}=await query('INSERT INTO classes(name,level,school_id,teacher_id)VALUES($1,$2,$3,$4)RETURNING*',[name,level,sid,teacher_id||null]);res.status(201).json(rows[0]);}catch(e){next(e);}});
r.put('/:id',async(req,res,next)=>{try{const{name,level,teacher_id}=req.body;const{rows}=await query('UPDATE classes SET name=COALESCE($1,name),level=COALESCE($2,level),teacher_id=COALESCE($3,teacher_id),updated_at=NOW()WHERE id=$4 RETURNING*',[name,level,teacher_id,req.params.id]);if(!rows.length)return res.status(404).json({error:'Classe non trouvée'});res.json(rows[0]);}catch(e){next(e);}});
r.delete('/:id',async(req,res,next)=>{try{await query('DELETE FROM classes WHERE id=$1',[req.params.id]);res.json({message:'Supprimée'});}catch(e){next(e);}});
module.exports=r;
