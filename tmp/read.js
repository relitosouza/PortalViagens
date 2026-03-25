const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
  const buffer = fs.readFileSync("e:/projetos/PortalVIagens/public/Cotacao HOSPEDAGEM.pdf");
  const data = await pdfParse(buffer);
  console.log(data.text);
}
test();
