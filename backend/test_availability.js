const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@skillswap.local', // Wait, I don't know the user's email.
      password: 'password123'
    });
  } catch(e) {
    console.log(e.response?.data);
  }
}
test();
