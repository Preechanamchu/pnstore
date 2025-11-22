// netlify/functions/orders-api.js
const db = require('./database');

exports.handler = async (event, context) => {
  const { httpMethod } = event;
  const { id } = event.queryStringParameters || {};

  try {
    // --- START: Handle different request methods ---
    switch (httpMethod) {
      case 'POST':
        // Create a new order
        return await createOrder(JSON.parse(event.body));
      
      case 'PUT':
        // Update an existing order (e.g., confirm or cancel)
        if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required for updates.' }) };
        return await updateOrder(id, JSON.parse(event.body));

      case 'DELETE':
        // Delete an order
        if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required for deletion.' }) };
        return await deleteOrder(id);

      default:
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    // --- END: Handle different request methods ---
  } catch (error) {
    console.error('Error in orders-api function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal server error occurred.' }),
    };
  }
};

// --- Function to CREATE a new order ---
async function createOrder(orderData) {
  // Basic validation
  if (!orderData || !orderData.id || !orderData.items || typeof orderData.total === 'undefined') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid order data provided.' }) };
  }

  const client = await db.pool.connect();
  try {
    // Insert the new order with a 'new' status. Stock is NOT updated at this stage.
    const insertOrderQuery = `
      INSERT INTO orders (order_id, timestamp, total, items, status, promo_applied)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await client.query(insertOrderQuery, [
      orderData.id,
      orderData.timestamp,
      orderData.total,
      JSON.stringify(orderData.items),
      'new', // All new orders start with 'new' status
      JSON.stringify(orderData.promoApplied || null)
    ]);

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Order created successfully and is awaiting confirmation.' }),
    };
  } finally {
    client.release();
  }
}

// --- Function to UPDATE an order's status ---
async function updateOrder(orderId, updateData) {
  const { status } = updateData;
  if (!status) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Status is required for update.' }) };
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order's current state to prevent re-processing
    const { rows } = await client.query('SELECT status, items FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }

    const currentStatus = rows[0].status;
    const items = rows[0].items;

    // *** IMPORTANT LOGIC ***
    // Only deduct stock if the order is being confirmed (moving from 'new' to 'active')
    if (currentStatus === 'new' && status === 'active') {
      for (const productId in items) {
        const quantity = items[productId];
        if (quantity > 0) {
          const updateStockQuery = `
            UPDATE products 
            SET stock = stock - $1 
            WHERE id = $2 AND stock != -1
          `;
          await client.query(updateStockQuery, [quantity, parseInt(productId)]);
        }
      }
    }
    
    // Always update the order status
    const updateStatusQuery = 'UPDATE orders SET status = $1 WHERE order_id = $2';
    await client.query(updateStatusQuery, [status, orderId]);

    await client.query('COMMIT');
    return { statusCode: 200, body: JSON.stringify({ message: `Order ${orderId} status updated to ${status}.` }) };

  } catch (e) {
    await client.query('ROLLBACK');
    throw e; // Let the main handler catch this
  } finally {
    client.release();
  }
}

// --- Function to DELETE an order ---
async function deleteOrder(orderId) {
  const client = await db.pool.connect();
  try {
    const result = await client.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
    if (result.rowCount === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ message: `Order ${orderId} deleted.` }) };
  } finally {
    client.release();
  }
}
