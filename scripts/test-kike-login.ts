
async function testLogin(email: string, pass: string) {
  const endpoint = 'https://varios-appwrite.fjueze.easypanel.host/v1';
  const projectId = '69f7a4cc001de1e8b9b7';

  console.log(`Testing login for ${email}...`);
  const response = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
    },
    body: JSON.stringify({ email, password: pass }),
  });

  const data = await response.json();
  if (response.ok) {
    console.log('Login successful!', data.$id);
  } else {
    console.log('Login failed:', data.message);
  }
}

testLogin('kike@jaigerhouse.com', 'Password123');
