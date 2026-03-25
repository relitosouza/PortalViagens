import { NextRequest, NextResponse } from "next/server";
const { PDFParse } = require("pdf-parse/node");
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sessão expirada ou não autorizado." }, { status: 401 });
  }

  console.log(">>> [PDF PARSER] Request received");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.log(">>> [PDF PARSER] No file provided");
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    console.log(`>>> [PDF PARSER] Processing file: ${file.name} (${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(">>> [PDF PARSER] Initializing PDFParse v2 (Node explicitly)...");
    const parser = new PDFParse({ data: buffer });
    
    console.log(">>> [PDF PARSER] Extracting text...");
    const pdfData = await parser.getText();
    await parser.destroy();
    
    const text = pdfData.text;
    console.log(`>>> [PDF PARSER] Extracted ${text.length} characters`);
    
    const voosEncontrados: any[] = [];
    
    // --- REAL WORLD PARSER LOGIC (Brositur Format) ---
    // (regex logic remains the same)
    const flightBlockRegex = /(\n\d{3,4}\s+\d{2}\/\d{2}\s+\d{2}:\d{2}\s+\d{2}\/\d{2}\s+\d{2}:\d{2}\s+([A-Z]{3})\s+-\s+([^-]+)\s+([A-Z]{3})\s+-\s+([^\n\d]+))/g;
    
    const blocks: string[] = [];
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
      const lineMatch = block.match(/(\d{3,4})\s+(\d{2}\/\d{2}\s+\d{2}:\d{2})\s+(\d{2}\/\d{2}\s+\d{2}:\d{2})\s+([A-Z]{3})\s+-\s+([^-]+)\s+([A-Z]{3})\s+-\s+([^\n\d]+)(\d{3}|7M8|738|320|321|E90|E95|AT7)\s+(\d{2}:\d{2})\s+(\d+)/);
      if (!lineMatch) return;
      const [_, flightNo, departureStr, arrivalStr, fromCode, fromCity, toCode, toCity, aircraft, duration, stops] = lineMatch;

      let companhia = "DESCONHECIDA";
      if (block.toLowerCase().includes("latam")) companhia = "LATAM";
      else if (block.toLowerCase().includes("gol")) companhia = "GOL";
      else if (block.toLowerCase().includes("azul")) companhia = "AZUL";
      else {
        const fn = parseInt(flightNo);
        if (fn >= 3000 && fn <= 4999) companhia = "LATAM";
        else if (fn >= 1000 && fn <= 1999) companhia = "GOL";
        else if (fn >= 2000 && fn <= 2999) companhia = "AZUL";
      }

      const fares: any[] = [];
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

    console.log(`>>> [PDF PARSER] Found ${voosEncontrados.length} flights`);
    return NextResponse.json({
      success: true,
      voos: voosEncontrados,
      rawTextLen: text.length,
      warning: voosEncontrados.length === 0 ? "O formato do PDF não foi reconhecido. Tente enviar novamente ou use outro arquivo." : null
    });
  } catch (error: any) {
    console.error(">>> [PDF PARSER] CRASH:", error);
    return NextResponse.json({ 
      error: "Erro ao processar PDF.", 
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
