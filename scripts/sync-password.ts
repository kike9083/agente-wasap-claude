
import { Client, Users } from 'node-appwrite';

async function updatePassword() {
  const client = new Client()
    .setEndpoint('https://varios-appwrite.fjueze.easypanel.host/v1')
    .setProject('69f7a4cc001de1e8b9b7')
    .setKey('standard_033af4826754ee09802c67e8b8b985e1e606e08ffc51b200d597ab54fb0d20a47145d1d5b309dea232ffb0b15d18ae27b2786ccb93b9ad5e42a480382e024b0de9217229e73cb18ccb8bb33734290cf1d862f8c0d888cd13d54aee780a5cd0aa59c4978a164ebe81730dbdf952102d8c93f8c6bdd2723582a7f8bbd697c6b430');

  const usersApi = new Users(client);

  try {
    // admin-dashboard is the ID found in previous script
    await usersApi.updatePassword('admin-dashboard', 'Admin1234!');
    console.log('Password updated successfully in Appwrite to Admin1234!');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

updatePassword();
