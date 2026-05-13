
import { Client, Users } from 'node-appwrite';

async function listAllUsers() {
  const client = new Client()
    .setEndpoint('https://varios-appwrite-techpadah.fjueze.easypanel.host/v1')
    .setProject('6a03855900044a4c6680')
    .setKey('standard_033af4826754ee09802c67e8b8b985e1e606e08ffc51b200d597ab54fb0d20a47145d1d5b309dea232ffb0b15d18ae27b2786ccb93b9ad5e42a480382e024b0de9217229e73cb18ccb8bb33734290cf1d862f8c0d888cd13d54aee780a5cd0aa59c4978a164ebe81730dbdf952102d8c93f8c6bdd2723582a7f8bbd697c6b430');

  const usersApi = new Users(client);

  try {
    const list = await usersApi.list();
    console.log('Users in Appwrite:');
    list.users.forEach(u => {
      console.log(`- Email: ${u.email}, ID: ${u.$id}, Status: ${u.status ? 'Active' : 'Inactive'}`);
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

listAllUsers();
