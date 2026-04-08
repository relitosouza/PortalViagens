import { NextRequest, NextResponse } from "next/server";
const { PDFParse, VerbosityLevel } = require("pdf-parse");
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

    console.log(">>> [PDF PARSER] Initializing pdf-parse v2.4.5...");
    const parser = new PDFParse({ 
      data: buffer, 
      verbosity: VerbosityLevel.ERRORS 
    });
    
    await parser.load();
    const textResult = await parser.getText();
    
    // getText() pode retornar string ou objeto com páginas dependendo do contexto
    let text: string;
    if (typeof textResult === 'string') {
      text = textResult;
    } else if (textResult && typeof textResult === 'object') {
      // Tenta extrair o texto de um objeto de páginas
      const asAny = textResult as any;
      if (typeof asAny.text === 'string') {
        text = asAny.text;
      } else if (Array.isArray(asAny.pages)) {
        text = asAny.pages.map((p: any) => p.text ?? p.content ?? '').join('\n');
      } else {
        text = JSON.stringify(textResult);
      }
    } else {
      text = String(textResult ?? '');
    }
    console.log(`>>> [PDF PARSER] Extracted ${text.length} characters`);
    
    const voosEncontrados: any[] = [];
    
    // 1. Identify Blocks starting with flight lines (e.g. "3000 26/03 06:00 26/03 07:45 CGH")
    // \s* handles both concatenated and space-separated text from pdf-parse
    const flightBlockRegex = /(\d{3,4}\s*\d{2}\/\d{2}\s*\d{2}:\d{2}\s*\d{2}\/\d{2}\s*\d{2}:\d{2}\s*[A-Z]{3})/g;
    
    // Split text into chunks
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
      // Extract main flight line
      const lineMatch = block.match(/(\d{3,4})\s*(\d{2}\/\d{2}\s*\d{2}:\d{2})\s*(\d{2}\/\d{2}\s*\d{2}:\d{2})\s*([A-Z]{3})\s*-\s*([^-]+?)\s*([A-Z]{3})\s*-\s*([^\n\d]+?)(?:\s*)(\d{3}|7M8|738|320|321|E90|E95|AT7|295)\s*(\d{2}:\d{2})\s*(\d+)/);
      
      if (!lineMatch) return;

      const [_, flightNo, departureStr, arrivalStr, fromCode, fromCity, toCode, toCity, aircraft, duration, stops] = lineMatch;

      // Intelligent Trecho Identification:
      // If Origin matches first word of Destiny in Solicitacao? 
      // Hardcoded heuristic for now as we don't have the solicitacao object here, 
      // but we can guess by order: first flight group is usually IDA, second is VOLTA.
      // Or by comparing cities. For now let's use a simpler approach:
      // The prompt asks to handle based on "Trecho: São Paulo / Brasília" etc.
      let sentido: 'ida' | 'volta' = 'ida';
      
      // If we find the specific reverse string in the block or previous text
      if (block.includes("Brasília") && block.includes("São Paulo") && block.indexOf("Brasília") < block.indexOf("São Paulo")) {
          sentido = 'volta';
      }

      let companhia = "DESCONHECIDA";
      const bLower = block.toLowerCase();
      if (bLower.includes("latam")) companhia = "LATAM";
      else if (bLower.includes("gol")) companhia = "GOL";
      else if (bLower.includes("azul")) companhia = "AZUL";
      else {
        const fn = parseInt(flightNo);
        if (fn >= 3000 && fn <= 4999) companhia = "LATAM";
        else if (fn >= 1000 && fn <= 1999) companhia = "GOL";
        else if (fn >= 2000 && fn <= 2999) companhia = "AZUL";
      }

      const fares: any[] = [];
      // Fare Regex (Refined to handle "smashed" money values: 1.813,000,0062,14)
      // We look for "Adulto", then the Family Name, then the baggage digit,
      // then a sequence of money values in the format XXX,XX
      const fareLines = block.matchAll(/Adulto\s*(.*?)\s*(\d)\s*([\d\.,]+)(?:\s*\(\d+\))?\s+([\d\.,]+)/gi);
      
      for (const fl of fareLines) {
        let [__, familia, bagagem, moneyChunk, total] = fl;
        
        // Use the suggested regex for separation: (\d[\d.]*,\d{2})
        // This will find matches like ["1.813,00", "0,00", "62,14"]
        const moneyMatches = moneyChunk.match(/(\d[\d.]*,\d{2})/g);
        
        let tarifa = "0,00";
        let du = "0,00";
        let taxa = "0,00";
        let passag = "1";

        if (moneyMatches && moneyMatches.length >= 1) {
          tarifa = moneyMatches[0];
          if (moneyMatches.length >= 2) du = moneyMatches[1];
          if (moneyMatches.length >= 3) taxa = moneyMatches[2];
        }

        // Extract passengers between parentheses: (2)
        const passMatch = block.match(/\((\d+)\)/);
        if (passMatch) {
          passag = passMatch[1];
        }

        fares.push({
          id: `v${index}-f${fares.length}`,
          tipo: "Adulto",
          familia: familia.trim(),
          bagagens: parseInt(bagagem),
          valorTarifa: tarifa,
          taxaEmbarque: taxa,
          passag: parseInt(passag),
          valorTotal: total.trim()
        });
      }

      if (fares.length > 0) {
        voosEncontrados.push({
          id: `v${index}`,
          companhia,
          numeroVoo: flightNo,
          sentido, // Novo campo
          origem: `${fromCity.trim()} (${fromCode})`,
          destino: `${toCity.trim()} (${toCode})`,
          partida: departureStr.trim(),
          chegada: arrivalStr.trim(),
          duracao: duration,
          escalas: parseInt(stops),
          tarifas: fares
        });
      }
    });

    // ----------------------------------------------------
    // EXTRAÇÃO DE HOSPEDAGEM (HOTÉIS)
    // ----------------------------------------------------
    const hoteisEncontrados: any[] = [];
    
    let checkIn = "";
    let checkOut = "";
    let cidadeHotel = "";
    
    // Melhorando captura de datas (DD/MM ou DD/MM/AAAA)
    const dateRegex = /(\d{2}\/\d{2}(?:\/\d{4})?)/g;
    const allDates = text.match(dateRegex) || [];
    
    // Na Brositur, as datas de hospedagem costumam vir após "Hospedagem" ou perto de "Check-in"
    const periodMatch = text.match(/(?:Check-in|Período|Hospedagem).*?(\d{2}\/\d{2}(?:\/\d{4})?).*?(\d{2}\/\d{2}(?:\/\d{4})?)/i);
    if (periodMatch) {
      checkIn = periodMatch[1];
      checkOut = periodMatch[2];
    } else if (allDates.length >= 2) {
      // Fallback: pega as duas últimas datas se não achar o rótulo (comum no fim do doc)
      checkIn = allDates[allDates.length - 2];
      checkOut = allDates[allDates.length - 1];
    }

    const cityMatch = text.match(/Trecho:\s*([^-]+?)\s*-[^-]+?-[^-]+?\s*Hospedagem/i) || text.match(/Local:\s*([A-Z\s,]{3,30})/i);
    if (cityMatch) cidadeHotel = cityMatch[1].trim();
    if (!cidadeHotel) cidadeHotel = "Brasília";

    // Look for Room matches around "Café da manhã" or other regimes
    const roomRegex = /(Double.*?|Single.*?|Quarto.*?|Standard.*?|Superior.*?|Luxo|Executive.*?|Twin.*?|Room.*?|Suite.*?|NON SMOKING.*?)\s+(Café da manhã|Sem café|Meia pensão|Pensao completa)\s+([\d\.,]+)/gi;
    const roomMatches = Array.from(text.matchAll(roomRegex)) as RegExpMatchArray[];
    
    roomMatches.forEach((rm, idx) => {
      // Aumentamos o raio para 600 caracteres para buscar o nome do hotel que pode estar longe (abaixo)
      const start = Math.max(0, (rm.index || 0) - 400);
      const end = Math.min(text.length, (rm.index || 0) + 600);
      const context = text.substring(start, end);
      
      let hotelName = "HOTEL DESCONHECIDO";
      
      // Nova Lógica: Procura por padrões de nome de hotel que contenham "Estrela(s)" ou nomes em CAIXA ALTA perto de palavras chave
      const starMatch = context.match(/(?:Hotel\s+)?([A-Z0-9\s,]{5,})\s*-\s*[\d\.]+\s*Estrela\(s\)/i);
      if (starMatch) {
        hotelName = starMatch[1].trim().toUpperCase();
      } else {
        const nameMatch = context.match(/([A-Z0-9][A-Z0-9\s,]{5,}(?:PLAZA|HOTEL|EXECUTIVE|VISION|RESORT|INN|PALACE|SUITES|LODGE|HPLUS|FLAT|STAY|RESIDENCE|GARDEN|COSMOPOLITAN|B-HOTEL|WDS|WYNDHAM|TRYP|RAMADA))/);
        if (nameMatch) {
          hotelName = nameMatch[1].trim().toUpperCase();
        } else {
          const commonHotels = ["KUBITSCHEK PLAZA", "MANHATTAN PLAZA", "B-HOTEL", "VISION EXECUTIVE", "STAYBRIDGE", "MELIA", "WINDSOR", "MERCURE", "HPLUS"];
          const found = commonHotels.find(h => context.toUpperCase().includes(h));
          if (found) hotelName = found;
          else {
             const upMatch = context.match(/([A-Z\s]{10,})/);
             if (upMatch) hotelName = upMatch[1].trim();
          }
        }
      }

      // Regra de valor: garante que pegamos apenas até as 2 casas decimais
      const valorLimpo = rm[3].match(/\d[\d.]*,\d{2}/)?.[0] || rm[3].trim();

      hoteisEncontrados.push({
        id: `h${idx}`,
        nome: hotelName,
        quarto: rm[1].trim(),
        regime: rm[2].trim(),
        valorTotal: valorLimpo,
        cidade: cidadeHotel,
        checkIn,
        checkOut,
        qtde: 1
      });
    });

    console.log(`>>> [PDF PARSER] Total flights items: ${voosEncontrados.length}, Total hotel items: ${hoteisEncontrados.length}`);
    return NextResponse.json({
      success: true,
      voos: voosEncontrados,
      hoteis: hoteisEncontrados,
      rawTextLen: text.length,
      warning: (voosEncontrados.length === 0 && hoteisEncontrados.length === 0) ? "O formato do PDF não foi reconhecido. Tente enviar novamente ou use outro arquivo." : null
    });
  } catch (error: any) {
    console.error(">>> [PDF PARSER] CRASH:", error);
    return NextResponse.json({ 
      error: "Falha ao processar o arquivo PDF. Verifique se o formato é válido."
    }, { status: 500 });
  }
}
