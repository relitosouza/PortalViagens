const fs = require('fs');
const { PDFParse, VerbosityLevel } = require('pdf-parse');

async function testParser() {
  try {
    const filePath = "e:/projetos/PortalVIagens/public/Cotacao HOSPEDAGEM.pdf";
    const buffer = fs.readFileSync(filePath);
    
    // Na v2.4.5, os dados devem ser passados no construtor dentro de 'options'
    const parser = new PDFParse({ 
      data: buffer, 
      verbosity: VerbosityLevel.ERRORS 
    });
    
    // O load() inicializa o documento com os dados fornecidos
    await parser.load();
    const text = await parser.getText();

    console.log("TEXTO EXTRAÍDO:");
    console.log("------------------------------------------");
    console.log(text);
    console.log("------------------------------------------");

  } catch (err) {
    console.error("ERRO:", err);
  }
}

testParser();
