// seeds/run.js — Seed complet avec bcrypt
// Usage: npm run seed
'use strict';
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

const users = [
  { id:'u1', name:'Herman SmartSchool', email:'admin@smartschool.cm', password:'Admin@2025', role:'admin', school_id:null, phone:'677000000', access_code:'ADMIN-ROOT', valid_year:2030,
    permissions: { view_students:true,add_students:true,edit_students:true,delete_students:true,enter_grades:true,edit_grades:true,print_bulletins:true,print_honor:true,print_certs:true,print_list:true,print_synthesis:true,manage_timetable:true,manage_subjects:true,view_timetable:true,edit_teachers:true,manage_discipline:true,manage_passes:true,view_synthesis:true,manage_progression:true,send_messages:true,send_sms:true,config_docs:true }
  },
  { id:'u2', name:'Marie-Claire Nkoudou', email:'directeur@flambeaux.cm', password:'Dir@2025', role:'principal', school_id:'s1', phone:'677001000', access_code:'ECO-FL01', valid_year:2026 },
  { id:'u2s', name:'Rose Mekongo', email:'sec@flambeaux.cm', password:'Sec@2025', role:'secretary', school_id:'s1', phone:'677001100', access_code:'SEC-FL01', valid_year:2026 },
  { id:'u6', name:'Céline Awono', email:'c.awono@flambeaux.cm', password:'Prof@2025', role:'teacher', school_id:'s1', phone:'677001200', access_code:'PROF-CA1', valid_year:2026 },
  { id:'u3', name:'Emmanuel Fotso', email:'directeur@college.cm', password:'Dir@2025', role:'principal', school_id:'s2', phone:'699002000', access_code:'COL-RE01', valid_year:2026 },
  { id:'u3s', name:'Julienne Bilong', email:'sec@college.cm', password:'Sec@2025', role:'secretary', school_id:'s2', phone:'699002100', access_code:'SEC-CO01', valid_year:2026 },
  { id:'u3v', name:'Issa Mahamat', email:'surv@college.cm', password:'Surv@2025', role:'surveillant', school_id:'s2', phone:'699002200', access_code:'SUR-CO01', valid_year:2026 },
  { id:'u4', name:'Dr. Pierre Ondoua', email:'directeur@leclerc.cm', password:'Dir@2025', role:'principal', school_id:'s3', phone:'677003000', access_code:'LYC-GL01', valid_year:2026 },
  { id:'u9', name:'Prof. Bernard Zang', email:'b.zang@leclerc.cm', password:'Prof@2025', role:'teacher', school_id:'s3', phone:'677003100', access_code:'PROF-BZ1', valid_year:2026 },
  { id:'u10', name:'Mme Claire Mvogo', email:'c.mvogo@leclerc.cm', password:'Prof@2025', role:'teacher', school_id:'s3', phone:'677003200', access_code:'PROF-CM1', valid_year:2026 },
  { id:'u5', name:'Mme Sophie Belibi', email:'directeur@bilingue.cm', password:'Dir@2025', role:'principal', school_id:'s4', phone:'677004000', access_code:'LYC-BI01', valid_year:2026 },
  { id:'u13', name:'Ing. Samuel Nkoa', email:'directeur@tech.cm', password:'Dir@2025', role:'principal', school_id:'s5', phone:'677005000', access_code:'LYT-YA01', valid_year:2026 },
  { id:'u14', name:'Ing. Marie Bello', email:'m.bello@tech.cm', password:'Prof@2025', role:'teacher', school_id:'s5', phone:'677005100', access_code:'PROF-MB1', valid_year:2026 },
  { id:'p1', name:'Paul Biya Jr', email:'parent@flambeaux.cm', password:'Par@2025', role:'parent', school_id:null, phone:'677100001', access_code:'PAR-001', valid_year:2026 },
  { id:'p2', name:'Roger Mvondo', email:'parent@leclerc.cm', password:'Par@2025', role:'parent', school_id:null, phone:'699100002', access_code:'PAR-002', valid_year:2026 },
];

// School UUID mapping for FK
const schoolMap = { s1:'11111111-0000-0000-0000-000000000001', s2:'11111111-0000-0000-0000-000000000002', s3:'11111111-0000-0000-0000-000000000003', s4:'11111111-0000-0000-0000-000000000004', s5:'11111111-0000-0000-0000-000000000005' };

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Démarrage du seed...');
    console.log('⏳ Hachage des mots de passe (peut prendre 30-60s)...');

    // Clear existing seed data
    await client.query('DELETE FROM sms_logs; DELETE FROM messages; DELETE FROM progression; DELETE FROM passes; DELETE FROM absences; DELETE FROM timetable; DELETE FROM grades; DELETE FROM subjects; DELETE FROM students; DELETE FROM classes; DELETE FROM users WHERE role != \'admin\' OR email = \'admin@smartschool.cm\';');

    // Insert users with bcrypt passwords
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, ROUNDS);
      const sid = u.school_id ? schoolMap[u.school_id] : null;
      const PA = { view_students:true,add_students:true,edit_students:true,delete_students:true,enter_grades:true,edit_grades:true,print_bulletins:true,print_honor:true,print_certs:true,print_list:true,print_synthesis:true,manage_timetable:true,manage_subjects:true,view_timetable:true,edit_teachers:true,manage_discipline:true,manage_passes:true,view_synthesis:true,manage_progression:true,send_messages:true,send_sms:true,config_docs:true };
      const PT = { view_students:true,enter_grades:true,edit_grades:true,view_timetable:true,manage_progression:true,send_messages:true };
      const PS = { view_students:true,manage_discipline:true,view_synthesis:true,manage_passes:true,send_messages:true };
      const PP = { view_students:true,send_messages:true };
      const perms = u.permissions || (u.role==='principal'||u.role==='secretary'?PA:u.role==='teacher'?PT:u.role==='surveillant'?PS:u.role==='parent'?PP:u.role==='admin'?PA:{});
      await client.query(
        `INSERT INTO users(id,name,email,password_hash,role,school_id,phone,access_code,valid_year,permissions,child_ids)
         VALUES(uuid_generate_v4(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name`,
        [u.name, u.email, hash, u.role, sid, u.phone, u.access_code, u.valid_year, JSON.stringify(perms), '{}']
      );
      process.stdout.write('.');
    }
    console.log('\n✅ Utilisateurs insérés');

    // Update school principals
    await client.query(`UPDATE schools SET principal_id=(SELECT id FROM users WHERE email='directeur@flambeaux.cm') WHERE id='11111111-0000-0000-0000-000000000001'`);
    await client.query(`UPDATE schools SET principal_id=(SELECT id FROM users WHERE email='directeur@college.cm') WHERE id='11111111-0000-0000-0000-000000000002'`);
    await client.query(`UPDATE schools SET principal_id=(SELECT id FROM users WHERE email='directeur@leclerc.cm') WHERE id='11111111-0000-0000-0000-000000000003'`);
    await client.query(`UPDATE schools SET principal_id=(SELECT id FROM users WHERE email='directeur@bilingue.cm') WHERE id='11111111-0000-0000-0000-000000000004'`);
    await client.query(`UPDATE schools SET principal_id=(SELECT id FROM users WHERE email='directeur@tech.cm') WHERE id='11111111-0000-0000-0000-000000000005'`);

    // Insert classes
    const classes = [
      ['CP - A','CP','s1','c.awono@flambeaux.cm'],
      ['CE1 - B','CE1','s1','c.awono@flambeaux.cm'],
      ['6ème A','6ème','s2',null],
      ['5ème B','5ème','s2',null],
      ['2nde A','2nde','s3','b.zang@leclerc.cm'],
      ['1ère D','1ère','s3','b.zang@leclerc.cm'],
      ['Tle C','Terminale','s3','c.mvogo@leclerc.cm'],
      ['Form 4A','Form 4','s4',null],
      ['2nde Tech - Élec.','2nde Technique','s5','m.bello@tech.cm'],
    ];
    for (const [name,level,sid,teacherEmail] of classes) {
      const schoolUUID = schoolMap[sid];
      const teacherRes = teacherEmail ? await client.query('SELECT id FROM users WHERE email=$1',[teacherEmail]) : { rows:[] };
      const teacherId = teacherRes.rows[0]?.id || null;
      await client.query('INSERT INTO classes(name,level,school_id,teacher_id)VALUES($1,$2,$3,$4)',[name,level,schoolUUID,teacherId]);
    }
    console.log('✅ Classes insérées');

    // Insert students (sample)
    const students = [
      ['Biya','Alice','2016-03-15','Yaoundé','F','CP - A','s1','Paul Biya Jr','FL-CP-001','parent@flambeaux.cm'],
      ['Eto','Émile Jr','2016-07-22','Douala','M','CP - A','s1','Samuel Eto','FL-CP-002',null],
      ['Mballa','Christiane','2016-05-10','Yaoundé','F','CP - A','s1','Jean Mballa','FL-CP-003',null],
      ['Manga','Grâce','2015-11-10','Bafoussam','F','CE1 - B','s1','Jacques Manga','FL-CE1-001',null],
      ['Zang','Martial','2008-06-17','Yaoundé','M','2nde A','s3','Bernard Zang','LGL-2A-001',null],
      ['Mvondo','Caroline','2008-11-25','Obili','F','2nde A','s3','Roger Mvondo','LGL-2A-002','parent@leclerc.cm'],
      ['Fouda','Théodore','2008-03-08','Biyem-Assi','M','2nde A','s3','Sylvain Fouda','LGL-2A-003',null],
      ['Nguini','Jean-Baptiste','2011-12-01','Douala','M','6ème A','s2','Henri Nguini','CR-6A-001',null],
      ['Kamga','Sylvie','2012-05-14','Bafoussam','F','6ème A','s2','Martin Kamga','CR-6A-002',null],
      ['Essono','Marc','2007-10-16','Mendong','M','2nde Tech - Élec.','s5','Julien Essono','LTY-2E-001',null],
    ];
    for (const [name,fn,dob,pob,gender,className,sid,parent,mat,parentEmail] of students) {
      const classRes = await client.query('SELECT id FROM classes WHERE name=$1 AND school_id=$2',[className,schoolMap[sid]]);
      if (!classRes.rows.length) continue;
      const cid = classRes.rows[0].id;
      const pRes = parentEmail ? await client.query('SELECT id FROM users WHERE email=$1',[parentEmail]) : { rows:[] };
      const pid = pRes.rows[0]?.id || null;
      await client.query(
        'INSERT INTO students(name,first_name,dob,pob,gender,class_id,school_id,parent_name,parent_user_id,matricule)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [name,fn,dob,pob,gender,cid,schoolMap[sid],parent,pid,mat]
      );
    }
    console.log('✅ Élèves insérés');

    // Update parent child_ids
    await client.query(`
      UPDATE users u SET child_ids = (
        SELECT COALESCE(array_agg(s.id), '{}')
        FROM students s WHERE s.parent_user_id = u.id
      ) WHERE u.role = 'parent'
    `);

    // Insert subjects for 2nde A
    const class2ndeRes = await client.query("SELECT id FROM classes WHERE name='2nde A'");
    if (class2ndeRes.rows.length) {
      const cid = class2ndeRes.rows[0].id;
      const bzRes = await client.query("SELECT id FROM users WHERE email='b.zang@leclerc.cm'");
      const cmRes = await client.query("SELECT id FROM users WHERE email='c.mvogo@leclerc.cm'");
      const bzId = bzRes.rows[0]?.id; const cmId = cmRes.rows[0]?.id;
      const subs = [
        ['Français',4,'litteraire',bzId],['Mathématiques',5,'scientifique',bzId],
        ['Anglais',3,'litteraire',bzId],['Histoire-Géographie',3,'litteraire',bzId],
        ['SVT',3,'scientifique',cmId],['Physique-Chimie',3,'scientifique',cmId],
        ['Informatique',1,'complementaire',cmId],['EPS',1,'complementaire',bzId],
      ];
      for (const [name,coef,grp,tid] of subs) {
        await client.query('INSERT INTO subjects(name,coef,class_id,teacher_id,group_key)VALUES($1,$2,$3,$4,$5)',[name,coef,cid,tid,grp]);
      }
    }
    console.log('✅ Matières insérées');

    // Insert sample grades
    const st2ndeRes = await client.query("SELECT s.id as sid, sub.id as subid, sub.name as subname FROM students s JOIN subjects sub ON sub.class_id=s.class_id WHERE s.class_id=(SELECT id FROM classes WHERE name='2nde A') ORDER BY s.name, sub.name");
    const studentSubjectPairs = st2ndeRes.rows;
    let gradeInserted = 0;
    for (const row of studentSubjectPairs) {
      for (const seq of ['1','2']) {
        const val = (Math.random() * 10 + 8).toFixed(1); // 8-18
        await client.query(
          'INSERT INTO grades(student_id,subject_id,seq,value)VALUES($1,$2,$3,$4)ON CONFLICT(student_id,subject_id,seq)DO NOTHING',
          [row.sid, row.subid, seq, parseFloat(val)]
        );
        gradeInserted++;
      }
    }
    console.log(`✅ ${gradeInserted} notes insérées (2nde A, Séq 1&2)`);

    await client.query('COMMIT');
    console.log('\n🎉 Seed terminé avec succès !');
    console.log('\n📋 Comptes créés :');
    console.log('  admin@smartschool.cm / Admin@2025 (Herman SmartSchool - Admin)');
    console.log('  directeur@flambeaux.cm / Dir@2025');
    console.log('  directeur@leclerc.cm / Dir@2025');
    console.log('  directeur@tech.cm / Dir@2025');
    console.log('  directeur@bilingue.cm / Dir@2025');
    console.log('  parent@flambeaux.cm / Par@2025');
    console.log('  parent@leclerc.cm / Par@2025');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur seed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
