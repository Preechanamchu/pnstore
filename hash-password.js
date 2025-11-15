// ไฟล์: hash-password.js
const bcrypt = require('bcryptjs');

// 1. รับรหัสผ่านจาก Command Line (อาร์กิวเมนต์ตัวที่ 3)
const passwordToHash = process.argv[2];

// 2. ตรวจสอบว่าผู้ใช้ป้อนรหัสผ่านหรือยัง
if (!passwordToHash) {
  console.error('❌ กรุณาระบุรหัสผ่านที่ต้องการแฮช!');
  console.error('ตัวอย่าง: node hash-password.js YourSecretPassword123');
  process.exit(1); // ออกจากโปรแกรมพร้อมแจ้งข้อผิดพลาด
}

// 3. กำหนดความซับซ้อน (Salt Rounds) - 10 คือค่ามาตรฐาน
const saltRounds = 10;

console.log(`กำลังสร้างแฮชสำหรับ: "${passwordToHash}"...`);

// 4. สร้างแฮช (แบบ Sync เพื่อง่ายต่อการรันสคริปต์)
try {
  const hashedPassword = bcrypt.hashSync(passwordToHash, saltRounds);

  // 5. แสดงผลลัพธ์
  console.log('✅ สร้างแฮชสำเร็จ!');
  console.log('---');
  console.log('Hashed Password (เก็บค่านี้ในฐานข้อมูลหรือ .env):');
  console.log(hashedPassword);
  console.log('---');

} catch (err) {
  console.error('เกิดข้อผิดพลาดในการสร้างแฮช:', err);
}