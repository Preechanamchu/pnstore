// netlify/functions/products-api.js
const requireAuth = require('./auth-middleware');
const db = require('./database');

const handler = async (event, context) => {
    const { httpMethod, queryStringParameters, body } = event;
    const id = queryStringParameters.id ? parseInt(queryStringParameters.id) : null;

    try {
        // ===== START: MODIFICATION =====
        // Add a GET handler to fetch ALL products for the admin panel
        if (httpMethod === 'GET') {
            // ===== START: UPDATE (Add max_order_quantity) =====
            // ดึงข้อมูลทั้งหมด รวมถึง max_order_quantity
            const result = await db.query('SELECT * FROM products ORDER BY category_id, level ASC');
            // ===== END: UPDATE =====
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        // ===== END: MODIFICATION =====

        if (httpMethod === 'POST') { // Create
            // ===== START: UPDATE (Add max_order_quantity) =====
            // เพิ่ม max_order_quantity จาก body
            const { name, name_en, level, category_id, stock, is_available, icon, unavailable_message, max_order_quantity } = JSON.parse(body);
            
            // เพิ่ม max_order_quantity ลงในคำสั่ง INSERT (ใช้ $9)
            await db.query(
                'INSERT INTO products (name, name_en, level, category_id, stock, is_available, icon, unavailable_message, max_order_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [name, name_en, level, category_id, stock, is_available, icon, unavailable_message, max_order_quantity || null] // || null เพื่อป้องกัน error ถ้าค่าเป็น undefined
            );
            // ===== END: UPDATE =====
            return { statusCode: 201, body: JSON.stringify({ message: 'Product created' }) };
        }

        if (httpMethod === 'PUT' && id) { // Update
            // This logic is now updated to handle partial updates,
            // like when only the 'is_available' toggle is changed.
            const updates = JSON.parse(body);
            const fields = [];
            const values = [];
            let queryIndex = 1;

            // List of allowed fields to prevent SQL injection
            // ===== START: UPDATE (Add max_order_quantity) =====
            // เพิ่ม 'max_order_quantity' ใน list ที่อนุญาตให้อัปเดต
            const allowedFields = ['name', 'name_en', 'level', 'category_id', 'stock', 'is_available', 'icon', 'unavailable_message', 'max_order_quantity'];
            // ===== END: UPDATE =====

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    // ===== START: UPDATE (Handle null for max_order_quantity) =====
                    // ถ้า field คือ max_order_quantity และค่าที่ส่งมาเป็น null หรือ '' ให้ตั้งเป็น null ใน DB
                    if (field === 'max_order_quantity' && (updates[field] === null || updates[field] === '')) {
                        fields.push(`${field} = $${queryIndex++}`);
                        values.push(null);
                    } else {
                        fields.push(`${field} = $${queryIndex++}`);
                        values.push(updates[field]);
                    }
                    // ===== END: UPDATE =====
                }
            }

            if (fields.length === 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'No fields to update' }) };
            }

            values.push(id); // Add the ID for the WHERE clause

            const updateQuery = `UPDATE products SET ${fields.join(', ')} WHERE id = $${queryIndex}`;
            await db.query(updateQuery, values);
            
            return { statusCode: 200, body: JSON.stringify({ message: 'Product updated' }) };
        }

        if (httpMethod === 'DELETE' && id) { // Delete
            await db.query('DELETE FROM products WHERE id=$1', [id]);
            return { statusCode: 200, body: JSON.stringify({ message: 'Product deleted' }) };
        }
        
        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error(`Error in products-api (${httpMethod}):`, error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Database operation failed.' }) };
    }
};

exports.handler = requireAuth(handler);
