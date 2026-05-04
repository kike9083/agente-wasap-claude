const questions = [
  "¿Me pueden dar el precio de la recámara principal?",
  "¿Tienen comedores de 6 sillas de madera?",
  "Hola, busco un colchón ortopédico matrimonial.",
  "¿Cuánto cuesta el sofá cama gris?",
  "¿Tienen mesas de centro de cristal?",
  "Quiero información sobre literas para niños.",
  "¿Venden sillas de oficina ergonómicas?",
  "¿Cuál es el precio del centro de entretenimiento para TV?",
  "¿Tienen salas esquineras en color beige?",
  "Me interesa un clóset de 3 puertas, ¿qué modelos tienen?"
];

// Cambia esta URL si tu endpoint local es diferente
const url = "http://localhost:3000/api/webhook"; 

async function runTest() {
  const NUM_REQUESTS = 50;
  console.log(`Iniciando ${NUM_REQUESTS} peticiones concurrentes a ${url}...`);

  const requests = Array.from({ length: NUM_REQUESTS }).map((_, index) => {
    // Escoger una pregunta aleatoria
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    // Crear el payload con número único y pregunta aleatoria
    const customPayload = {
      object: "whatsapp_business_account",
      entry: [{ 
        id: "123", 
        changes: [{ 
          value: { 
            messages: [{ 
              from: `123456789_${index}`, 
              text: { body: randomQuestion } 
            }] 
          } 
        }] 
      }]
    };
    
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customPayload),
    }).then(async res => {
      return { status: res.status, id: index, question: randomQuestion };
    }).catch(err => {
      return { status: "Error", error: err.message, id: index, question: randomQuestion };
    });
  });

  const results = await Promise.all(requests);
  
  // Agrupar resultados para ver cuántos fueron exitosos o fallaron
  const summary = results.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});

  console.log("\n--- RESULTADOS DE LA PRUEBA ---");
  console.log(summary);
  console.log("\nMuestra de las preguntas enviadas:");
  results.slice(0, 5).forEach(r => console.log(`- [${r.status}] ${r.question}`));
}

runTest();
