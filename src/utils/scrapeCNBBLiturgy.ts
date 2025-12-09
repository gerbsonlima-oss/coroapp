import { JSDOM } from 'jsdom';

interface CNBBLiturgiaResponse {
  title: string;
  date: string;
  readings: string;
  secondReading?: string;
  psalm: string;
  gospel: string;
  error?: string;
}

export async function scrapeCNBBLiturgy(dateStr: string): Promise<CNBBLiturgiaResponse> {
  try {
    const url = 'https://www.cnbb.org.br/liturgia-diaria/';
    const response = await fetch(url);
    const html = await response.text();

    const dom = new JSDOM(html, {
      url: url,
      contentType: 'text/html',
      pretendToBeVisual: true,
    });

    const document = dom.window.document;

    const contentDiv = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

    let readings = 'Leituras não disponíveis';
    let psalm = 'Salmo não disponível';
    let gospel = 'Evangelho não disponível';
    let title = 'Liturgia do Dia';

    const allText = contentDiv?.textContent || '';

    if (allText.includes('Primeira Leitura') || allText.includes('primeira leitura')) {
      const startIdx = allText.indexOf('Primeira Leitura') >= 0 
        ? allText.indexOf('Primeira Leitura')
        : allText.indexOf('primeira leitura');
      
      const nextSectionIdx = Math.min(
        allText.indexOf('Salmo', startIdx + 20) > -1 ? allText.indexOf('Salmo', startIdx + 20) : Infinity,
        allText.indexOf('Segunda Leitura', startIdx + 20) > -1 ? allText.indexOf('Segunda Leitura', startIdx + 20) : Infinity,
      );

      readings = allText.substring(startIdx, nextSectionIdx > startIdx ? nextSectionIdx : startIdx + 500).slice(0, 500);
    }

    if (allText.includes('Salmo') || allText.includes('salmo')) {
      const startIdx = allText.indexOf('Salmo') >= 0 ? allText.indexOf('Salmo') : allText.indexOf('salmo');
      const nextSectionIdx = Math.min(
        allText.indexOf('Evangelho', startIdx + 10) > -1 ? allText.indexOf('Evangelho', startIdx + 10) : Infinity,
        allText.indexOf('Segunda Leitura', startIdx + 10) > -1 ? allText.indexOf('Segunda Leitura', startIdx + 10) : Infinity,
      );
      psalm = allText.substring(startIdx, nextSectionIdx > startIdx ? nextSectionIdx : startIdx + 400).slice(0, 400);
    }

    if (allText.includes('Evangelho') || allText.includes('evangelho')) {
      const startIdx = allText.indexOf('Evangelho') >= 0 ? allText.indexOf('Evangelho') : allText.indexOf('evangelho');
      gospel = allText.substring(startIdx, startIdx + 500).slice(0, 500);
    }

    return {
      title: title,
      date: dateStr,
      readings: readings.trim(),
      psalm: psalm.trim(),
      gospel: gospel.trim(),
    };
  } catch (error) {
    console.error('Erro ao fazer scraping da CNBB:', error);
    return {
      title: 'Liturgia do Dia',
      date: dateStr,
      readings: 'Erro ao buscar leituras',
      psalm: 'Erro ao buscar salmo',
      gospel: 'Erro ao buscar evangelho',
      error: String(error),
    };
  }
}
