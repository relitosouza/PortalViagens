import { NextRequest, NextResponse } from "next/server";
const pdfParse = require("pdf-parse");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    // Advanced Regex parsing would go here.
    // For now, since we don't have the exact format of Brositur, 
    // we will return a structured mock if no data is matched.
    // Replace this logic with actual regex parsing when the PDF sample is provided.

    const voosEncontrados = [];

    // Mocking an example structure that fits the new requirements
    voosEncontrados.push({
      id: Date.now().toString(),
      companhia: "LATAM",
      numeroVoo: "LA3450",
      origem: "São Paulo (GRU)",
      destino: "Brasília (BSB)",
      partida: "20/10/2026 08:30",
      chegada: "20/10/2026 10:15",
      duracao: "1h45m",
      escalas: 0,
      tarifas: [
        {
          id: "t1",
          tipo: "Adulto",
          familia: "Light",
          bagagens: 0,
          valorTarifa: "1000,00",
          taxaEmbarque: "50,50",
          valorTotal: "1050,50"
        },
        {
          id: "t2",
          tipo: "Adulto",
          familia: "Standard",
          bagagens: 1,
          valorTarifa: "1250,00",
          taxaEmbarque: "50,50",
          valorTotal: "1300,50"
        }
      ]
    });

    voosEncontrados.push({
      id: (Date.now() + 1).toString(),
      companhia: "GOL",
      numeroVoo: "G31520",
      origem: "São Paulo (CGH)",
      destino: "Brasília (BSB)",
      partida: "20/10/2026 09:00",
      chegada: "20/10/2026 10:50",
      duracao: "1h50m",
      escalas: 0,
      tarifas: [
        {
          id: "t3",
          tipo: "Adulto",
          familia: "Light",
          bagagens: 0,
          valorTarifa: "980,00",
          taxaEmbarque: "45,00",
          valorTotal: "1025,00"
        },
        {
          id: "t4",
          tipo: "Adulto",
          familia: "Plus",
          bagagens: 1,
          valorTarifa: "1180,00",
          taxaEmbarque: "45,00",
          valorTotal: "1225,00"
        }
      ]
    });

    return NextResponse.json({
      success: true,
      voos: voosEncontrados,
      rawTextLen: text.length
    });
  } catch (error) {
    console.error("PDF parse error:", error);
    return NextResponse.json({ error: "Erro ao processar PDF. Verifique se o arquivo está corrompido ou protegido." }, { status: 500 });
  }
}
