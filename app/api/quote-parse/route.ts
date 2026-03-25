import { NextRequest, NextResponse } from "next/server";
const { PDFParse } = require("pdf-parse");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf-parse v2 API
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    
    const text = pdfData.text;
    const voosEncontrados: any[] = [];
    
    // --- REAL WORLD PARSER LOGIC (Brositur Format) ---
    
    // 1. Identify Blocks starting with flight lines (e.g. "4737 27/03 19:30")
    // Pattern: [FlightNo] [Date] [Time] [Date] [Time] [From] - [City] [To] - [City]
    const flightBlockRegex = /(\n\d{3,4}\s+\d{2}\/\d{2}\s+\d{2}:\d{2}\s+\d{2}\/\d{2}\s+\d{2}:\d{2}\s+([A-Z]{3})\s+-\s+([^-]+)\s+([A-Z]{3})\s+-\s+([^\n\d]+))/g;
    
    // Split text into chunks manually as regex split is tricky here
    const blocks: string[] = [];
    let lastIndex = 0;
    let match;
    const matches: any[] = [];

    while ((match = flightBlockRegex.exec(text)) !== null) {
      matches.push(match);
    }

    matches.forEach((m, i) => {
      const start = m.index;
      const end = matches[i + 1] ? matches[i + 1].index : text.length;
      blocks.push(text.substring(start, end));
    });

    blocks.forEach((block, index) => {
      // Extract main flight line
      const lineMatch = block.match(/(\d{3,4})\s+(\d{2}\/\d{2}\s+\d{2}:\d{2})\s+(\d{2}\/\d{2}\s+\d{2}:\d{2})\s+([A-Z]{3})\s+-\s+([^-]+)\s+([A-Z]{3})\s+-\s+([^\n\d]+)(\d{3}|7M8|738|320|321|E90|E95|AT7)\s+(\d{2}:\d{2})\s+(\d+)/);
      
      if (!lineMatch) return;

      const [_, flightNo, departureStr, arrivalStr, fromCode, fromCity, toCode, toCity, aircraft, duration, stops] = lineMatch;

      // Airline heuristic (LATAM: 3xxx/4xxx/8xxx, GOL: 1xxx/2xxx, Azul: 2xxx/4xxx/9xxx)
      // Brositur often lists the logo or name above. Let's look for known keywords in the segment nearby.
      let companhia = "DESCONHECIDA";
      if (block.toLowerCase().includes("latam")) companhia = "LATAM";
      else if (block.toLowerCase().includes("gol")) companhia = "GOL";
      else if (block.toLowerCase().includes("azul")) companhia = "AZUL";
      else {
        // Fallback by flight number range
        const fn = parseInt(flightNo);
        if (fn >= 3000 && fn <= 4999) companhia = "LATAM";
        else if (fn >= 1000 && fn <= 1999) companhia = "GOL";
        else if (fn >= 2000 && fn <= 2999) companhia = "AZUL";
      }

      const fares: any[] = [];
      // Look for fare lines: "Adulto [Family] [Bags] [Price] [Tax] [Total]"
      // Example: "Adulto Light 0 1.988,40 0,00 32,87 (2) 4.042,54"
      const fareLines = block.matchAll(/Adulto\s+([A-Z\s]+)\s+(\d+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)(?:\s+\([^\)]+\))?\s+([\d\.,]+)/gi);
      
      for (const fl of fareLines) {
        const [__, familia, bagagem, tarifa, du, taxa, total] = fl;
        fares.push({
          id: `v${index}-f${fares.length}`,
          tipo: "Adulto",
          familia: familia.trim(),
          bagagens: parseInt(bagagem),
          valorTarifa: tarifa,
          taxaEmbarque: taxa,
          valorTotal: total
        });
      }

      if (fares.length > 0) {
        voosEncontrados.push({
          id: `v${index}`,
          companhia,
          numeroVoo: flightNo,
          origem: `${fromCity.trim()} (${fromCode})`,
          destino: `${toCity.trim()} (${toCode})`,
          partida: departureStr,
          chegada: arrivalStr,
          duracao: duration,
          escalas: parseInt(stops),
          tarifas: fares
        });
      }
    });

    return NextResponse.json({
      success: true,
      voos: voosEncontrados,
      rawTextLen: text.length,
      warning: voosEncontrados.length === 0 ? "O formato do PDF não foi reconhecido. Tente enviar novamente ou use outro arquivo." : null
    });
  } catch (error) {
    console.error("PDF parse error:", error);
    return NextResponse.json({ error: "Erro ao processar PDF." }, { status: 500 });
  }
}
