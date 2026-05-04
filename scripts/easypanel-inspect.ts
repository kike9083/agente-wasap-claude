
async function inspect() {
  const apiKey = '76939012c53c2ac59762c16214501bbec0707c150db6a6828334dfd3c56d0358';
  const baseUrl = 'https://fjueze.easypanel.host/api/trpc/services.app.inspectService';
  
  const input = {
    "0": {
      "json": {
        "projectName": "varios",
        "serviceName": "agente-wasap"
      }
    }
  };

  const url = `${baseUrl}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey
      }
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

inspect();
