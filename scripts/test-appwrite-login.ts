
async function testAppwriteLogin() {
  const endpoint = 'https://varios-appwrite.fjueze.easypanel.host/v1';
  const projectId = '69f7a4cc001de1e8b9b7';
  const email = 'admin@jaigerhouse.com';
  const password = 'Admin1234!';

  console.log(`Testing login for ${email} at ${endpoint}...`);

  try {
    const res = await fetch(`${endpoint}/account/sessions/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log('Login SUCCESSFUL!');
      console.log('User ID:', data.userId);
    } else {
      console.error('Login FAILED!');
      console.error('Status:', res.status);
      console.error('Error:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('Network Error:', error.message);
  }
}

testAppwriteLogin();
