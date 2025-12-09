import express from 'express';
import cors from 'cors';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());

const liturgyCache = new Map();

const liturgyDatabase = {
  '09/12/2025': {
    data: '09/12/2025',
    liturgia: '2ª-feira da 2ª Semana do Advento',
    cor: 'roxo',
    leituras: {
      primeiraLeitura: [
        {
          referencia: 'Is 40, 1-11',
          titulo: 'Leitura do Livro do Profeta Isaías',
          texto: 'Consolai o meu povo, consolai-o! — diz o vosso Deus. Falai ao coração de Jerusalém e dizei em alta voz que sua servidão acabou e a expiação de suas culpas foi cumprida; ela recebeu das mãos do Senhor o dobro por todos os seus pecados. Grita uma voz: "preparai no deserto o caminho do Senhor, aplainai na solidão a estrada de nosso Deus. Nivelem-se todos os vales, rebaixem-se todos os montes e colinas; endireite-se o que é torto e alisem-se as asperezas: a glória do Senhor então se manifestará, e todos os homens verão juntamente o que a boca do Senhor falou". Dizia uma voz: "Grita!" E respondi: "O que devo gritar?" A criatura humana é feno, toda a sua glória é como flor do campo; seca o feno, murcha a flor ao soprar o Senhor sobre eles. Sim, o povo é feno. Seca o feno, murcha a flor, mas a palavra de nosso Deus fica para sempre. Sobe a um alto monte, tu, que trazes a boa nova a Sião; levanta com força a tua voz, tu, que trazes a boa nova a Jerusalém, ergue a voz, não temas; dize às cidades de Judá: "Eis o vosso Deus, eis que o Senhor Deus vem com poder, seu braço tudo domina: eis, com ele, sua conquista, eis à sua frente a vitória. Como um pastor, ele apascenta o rebanho, reúne, com a força dos braços, os cordeiros e carrega-os ao colo; ele mesmo tange as ovelhas-mães".'
        }
      ],
      salmo: [
        {
          referencia: 'Sl 95',
          refrao: 'Olhai e vede: o nosso Deus vem com poder!',
          texto: '— Cantai ao Senhor Deus um canto novo, cantai ao Senhor Deus, ó terra inteira! Cantai e bendizei seu santo nome! Dia após dia anunciai sua salvação. \n— Manifestai a sua glória entre as nações, e entre os povos do universo seus prodígios! Publicai entre as nações: "Reina o Senhor!" E os povos ele julga com justiça. \n— O céu se rejubile e exulte a terra, aplauda o mar com o que vive em suas águas; os campos com seus frutos rejubilem e exultem as florestas e as matas. \n— Na presença do Senhor, pois ele vem, porque vem para julgar a terra inteira. Governará o mundo todo com justiça, e os povos julgará com lealdade.'
        }
      ],
      segundaLeitura: [],
      evangelho: [
        {
          referencia: 'Mt 18, 12-14',
          titulo: 'Proclamação do Evangelho de Jesus Cristo ✠ segundo Mateus',
          texto: 'Naquele tempo, disse Jesus aos seus discípulos: Que vos parece? Se um homem tem cem ovelhas, e uma delas se perde, não deixa ele as noventa e nove nas montanhas, para procurar aquela que se perdeu? Em verdade vos digo, se ele a encontrar, ficará mais feliz com ela, do que com as noventa e nove que não se perderam. Do mesmo modo, o Pai que está nos céus não deseja que se perca nenhum desses pequeninos.'
        }
      ]
    }
  },
  '10/12/2025': {
    data: '10/12/2025',
    liturgia: '3ª-feira da 2ª Semana do Advento',
    cor: 'roxo',
    leituras: {
      primeiraLeitura: [
        {
          referencia: 'Is 40, 25-31',
          titulo: 'Leitura do Livro do Profeta Isaías',
          texto: 'Assim diz o Senhor: A quem me compararei para que seja meu igual? — Diz o Santo. Levantai os olhos para o alto e vede: quem criou estas coisas? Aquele que faz sair em ordem o seu exército e chama cada uma pelo seu nome. Tal é o seu poder e a sua força, que nem uma só desaparece. Por que dizes, ó Jacó, e por que afirmas, ó Israel: "O meu destino está oculto ao Senhor, e meu direito passou despercebido por meu Deus"? Não o sabes? Não o ouviste? O Senhor é o Deus eterno, que criou os confins da terra. Não se cansa, nem se fatiga; sua inteligência é insondável. Ele dá força ao cansado e aumenta o vigor do que está sem forças. Os moços se cansam e se fatiga; os jovens tropeçam e caem: mas os que esperam no Senhor renovam suas forças, sobem com asas como de águias, correm e não se cansam, caminham e não se fatigam.'
        }
      ],
      salmo: [
        {
          referencia: 'Sl 102',
          refrao: 'Bendize, ó minha alma, ao Senhor!',
          texto: '— Bendize, ó minha alma, ao Senhor, e tudo em mim bendiga seu santo nome. Bendize, ó minha alma, ao Senhor, e não esqueças de seus benefícios. \n— Ele é quem te perdoa todas as faltas, te cura de todas as doenças. Ele te salva da perdição, te cerca de amor e de ternura. \n— O Senhor é cheio de piedade e de misericórdia, lento em irar-se, grande em benignidade. Como é distante o oriente do ocidente, assim afasta de nós as nossas culpas. \n— Como um pai é piedoso para com seus filhos, assim o Senhor é piedoso para com seus fiéis. Como o Senhor é bom! Bendito seja seu nome!'
        }
      ],
      segundaLeitura: [],
      evangelho: [
        {
          referencia: 'Mt 11, 28-30',
          titulo: 'Proclamação do Evangelho de Jesus Cristo ✠ segundo Mateus',
          texto: 'Naquele tempo, disse Jesus: Vinde a mim, vós todos que estais cansados e oprimidos, e eu vos darei repouso. Tomai sobre vós o meu jugo e aprendei de mim, que sou manso e humilde de coração, e encontrareis repouso para vossas almas. Porque o meu jugo é suave, e meu fardo é leve.'
        }
      ]
    }
  },
  '08/12/2025': {
    data: '08/12/2025',
    liturgia: 'Solenidade da Imaculada Conceição de Maria',
    cor: 'branco',
    leituras: {
      primeiraLeitura: [
        {
          referencia: 'Gn 3, 9-15. 20',
          titulo: 'Leitura do Livro do Gênesis',
          texto: 'Naqueles dias, o Senhor Deus chamou o homem e lhe disse: "Onde estás?" Ele respondeu: "Ouvi o som de teus passos no jardim, tive medo porque estou nu, por isso me escondi." Perguntou o Senhor: "Quem te informou que estás nu? Será que comeste da árvore de que te ordenei que não comesses?" O homem respondeu: "A mulher que me deste por companheira me ofereceu do fruto da árvore, e comi." Disse então o Senhor Deus à mulher: "Por que fizeste isso?" A mulher respondeu: "A serpente me enganou, e comi." Então o Senhor Deus disse à serpente: "Porque fizeste isso, serás maldita entre todos os animais domésticos e entre as bestas da terra. Vou inimizade entre ti e a mulher, entre tua descendência e a sua. Ela te ferirá a cabeça e tu lhe ferirás o calcanhar." O homem deu a sua esposa o nome de Eva, porque foi ela a mãe de todos os viventes.'
        }
      ],
      salmo: [
        {
          referencia: 'Sl 97',
          refrao: 'Cantai ao Senhor uma louvor toda nova!',
          texto: '— Cantai ao Senhor uma louvor toda nova, porque fez maravilhas! Sua destra e seu braço santo lhe trazem a vitória. \n— O Senhor deu a conhecer sua salvação, manifestou sua justiça ante as nações. Lembrou-se de sua misericórdia e de sua fidelidade. \n— Todos os confins da terra viram a salvação do nosso Deus. Exultai de alegria, ó terra toda, aclamai e cantai louvores! \n— Cantai ao Senhor com a harpa, com a harpa e voz de salmo. Com clarins e ao som da trompa, exultai diante do Senhor, o nosso Rei!'
        }
      ],
      segundaLeitura: [
        {
          referencia: 'Ef 1, 3-6. 11-12',
          titulo: 'Leitura da Carta de São Paulo aos Efésios',
          texto: 'Bendito seja o Deus e Pai de nosso Senhor Jesus Cristo que nos abençoou com toda sorte de bênção espiritual nos céus, em Cristo. Assim, escolheu-nos nele antes da fundação do mundo, para sermos santos e irrepreensíveis em sua presença pela caridade. E predestinou-nos para sermos seus filhos adotivos por Jesus Cristo, segundo o bom prazer de sua vontade, para louvor da glória de sua graça, que nos deu gratuitamente no Amado. Nele ainda, fomos feitos herdeiros, predestinados segundo o propósito d\'Aquele que tudo realiza conforme a decisão de sua vontade: para que nós, que primeiro esperamos em Cristo, servíssemos de louvor para a sua glória.'
        }
      ],
      evangelho: [
        {
          referencia: 'Lc 1, 26-38',
          titulo: 'Proclamação do Evangelho de Jesus Cristo ✠ segundo Lucas',
          texto: 'Naquele tempo, o anjo Gabriel foi enviado por Deus a uma cidade da Galiléia, chamada Nazaré, a uma virgem desposada com um homem chamado José, da casa de Davi. O nome da virgem era Maria. Ao entrar onde ela estava, disse: "Alegra-te, cheia de graça! O Senhor é contigo." Maria ficou perturbada com estas palavras e pensava no que significaria esta saudação. O anjo lhe disse: "Não temas, Maria, pois encontraste graça diante de Deus. Eis que conceberás e darás à luz um filho, a quem porás o nome de Jesus. Ele será grande e será chamado Filho do Altíssimo. O Senhor Deus lhe dará o trono de Davi, seu pai, e ele reinará eternamente sobre a casa de Jacó, e seu reino não terá fim." Maria perguntou ao anjo: "Como se fará isso, pois não tenho relação com homem algum?" O anjo lhe respondeu: "O Espírito Santo virá sobre ti, e o poder do Altíssimo te envolverá com sua sombra. Por isso, o ser que há de nascer será chamado Santo, Filho de Deus. E eis que Isabel, tua parenta, também concebeu um filho em sua velhice, e este é o sexto mês para aquela que era considerada estéril, porque para Deus nada é impossível." Maria disse: "Eis aqui a serva do Senhor, faça-se em mim segundo a tua palavra." E o anjo retirou-se dela.'
        }
      ]
    }
  },
  '11/12/2025': {
    data: '11/12/2025',
    liturgia: '4ª-feira da 2ª Semana do Advento',
    cor: 'roxo',
    leituras: {
      primeiraLeitura: [
        {
          referencia: 'Is 41, 13-20',
          titulo: 'Leitura do Livro do Profeta Isaías',
          texto: 'Porque eu sou o Senhor, teu Deus, que te tomo pela mão direita e te digo: não temas, eu te ajudarei. Não temas, ó verme de Jacó, fraqueza de Israel! Eu te ajudarei — oráculo do Senhor, teu redentor, o Santo de Israel. Eis que faço de ti um batedouro novo, com dentes agudos. Baterás os montes e os desfarás, reduzirás os morros a pó. Joeirá-los-ás, e o vento os levará; o furacão os dispersará. Tu, porém, te regozijará no Senhor e te gloriarás no Santo de Israel. Eis que os pobres e os miseráveis procuram água, e não há; a sua língua está seca de sede. Eu, o Senhor, vou ouvi-los; eu, o Deus de Israel, não os abandonarei. Farei brotar fonte nos montes desertos e nascentes no meio dos vales. Transformarei o deserto em piscina de água e as terras áridas em fontes. Plantarei no deserto cedro, acácia, murta e oliveira; colocarei na estepe cipreste, ulmeiro e abeto, para que vejam e saibam, para que considerem e compreendam que a mão do Senhor fez isso, que o Santo de Israel o criou.'
        }
      ],
      salmo: [
        {
          referencia: 'Sl 145',
          refrao: 'O Senhor sustém e ampara os que se inclinam.',
          texto: '— Louvarei a ti, meu Deus, ó Rei, e bendirei a teu nome, sempre e eternamente. Todos os dias hei de bendizia-te, e louvarei o teu nome, sempre e eternamente. \n— O Senhor é grande e merecedor de todos os louvores; é infinita a sua grandeza. Gerações e gerações cantarão a teus feitos e enaltecem a tua majestade. \n— Teu nome exprime a riqueza de tua glória e a esplendidez de teu poder. Recordar-me-ei de tudo quanto fizeste de magnifico e de maravilhoso. \n— O Senhor é benigno e cheio de piedade, lento na ira e generoso em bondade. O Senhor é bom com todos, sua ternura estende-se sobre todas as criaturas.'
        }
      ],
      segundaLeitura: [],
      evangelho: [
        {
          referencia: 'Mt 11, 2-11',
          titulo: 'Proclamação do Evangelho de Jesus Cristo ✠ segundo Mateus',
          texto: 'Naquele tempo, João, que estava na prisão, ouviu falar das obras de Cristo. Enviou-lhe, pois, alguns de seus discípulos, para lhe perguntar: "É tu o que deve vir, ou devemos esperar outro?" Jesus respondeu-lhes: "Ide e anunciai a João o que ouvis e vedes: os cegos veem, os coxos andam, os leprosos são purificados, os surdos ouvem, os mortos ressuscitam, e aos pobres é anunciada a boa nova. Bem-aventurado aquele que não se escandalizar em mim!" Quando eles se foram, Jesus começou a falar sobre João às multidões: "Que fostes ver no deserto? Uma cana agitada pelo vento? Que fostes então ver? Um homem vestido luxuosamente? Vede bem: os que usam trajes luxuosos estão nas casas dos reis. Mas então, que fostes ver? Um profeta? Sim, vos digo, e muito mais que um profeta. É este aquele de quem está escrito: Eis que diante de ti envio o meu mensageiro, que há de preparar o caminho diante de ti. Em verdade vos digo: entre os nascidos de mulher não apareceu outro maior que João Batista; entretanto, o menor no reino dos céus é maior que ele."'
        }
      ]
    }
  }
};

function getLiturgyForDate(date) {
  const cacheKey = `liturgy_${date}`;
  
  if (liturgyCache.has(cacheKey)) {
    return liturgyCache.get(cacheKey);
  }
  
  let result = liturgyDatabase[date];
  
  if (!result) {
    result = {
      data: date,
      liturgia: 'Dia comum do Advento',
      cor: 'roxo',
      leituras: {
        primeiraLeitura: [
          {
            referencia: 'Is 35, 1-10',
            titulo: 'Leitura do Livro do Profeta Isaías',
            texto: 'Regozije-se o deserto e a terra árida, alegre-se e floresça como a rosa. Florescerá magnificamente, exultará de alegria e cantará. Lhe será dada a glória do Líbano, a beleza do Carmelo e de Saron. Eles verão a glória do Senhor, a beleza do nosso Deus. Fortalecei as mãos fracas, firmae os joelhos que vacilam. Dizei aos de coração perturbado: "Coragem, não temais! Vede, nosso Deus virá trazer a vingança, Deus virá com retribuição: ele mesmo virá e vos salvará." Então se abrirão os olhos dos cegos e os ouvidos dos surdos se desimpedirão. Então saltará o coxo como um cervo, e brotará uma língua para o mudo. Pois águas hão de brotar no deserto e torrentes na terra árida. O chão ardente tornar-se-á um lago, e a terra ressequida, brotará nascentes. Nas tabas dos chacais, onde dormem, florescerão caniços e tamargueiras. Haverá ali uma estrada e um caminho que se chamará "Caminho da Santidade"; por ele não passará pessoa impura. Será para Israel um caminho próprio; nem viajantes nem néscios nele errarão. Não haverá nele leão, nem fera alguma subirá por ele; não se encontrará nele, mas os resgatados caminharão por ele. Voltarão os resgatados pelo Senhor, virão a Sião com exultação, e uma alegria eterna coroará suas cabeças; alcançarão gozo e alegria, desaparecerá a tristeza e o gemido.'
          }
        ],
        salmo: [
          {
            referencia: 'Sl 145',
            refrao: 'O Senhor sustém e ampara os que se inclinam.',
            texto: '— Louvarei a ti, meu Deus, ó Rei, e bendirei a teu nome, sempre e eternamente. Todos os dias hei de bendizia-te, e louvarei o teu nome, sempre e eternamente. \n— O Senhor é grande e merecedor de todos os louvores; é infinita a sua grandeza.'
          }
        ],
        segundaLeitura: [],
        evangelho: [
          {
            referencia: 'Mt 3, 1-12',
            titulo: 'Proclamação do Evangelho de Jesus Cristo ✠ segundo Mateus',
            texto: 'Naqueles dias, apareceu João Batista, pregando no deserto da Judeia e dizendo: "Fazei penitência, pois está próximo o reino dos céus." João é este de quem falava o profeta Isaías: "Uma voz clama no deserto: preparai o caminho do Senhor, endireitai as suas veredas." João tinha um vestuário de pelos de camelo e um cinto de couro à volta dos rins. Seu alimento eram gafanhotos e mel silvestre. Saíam para junto dele Jerusalém, toda a Judeia e toda a região vizinha do Jordão, e ele os batizava no rio Jordão, confessando seus pecados.'
          }
        ]
      }
    };
  }
  
  liturgyCache.set(cacheKey, result);
  return result;
}

app.get('/api/liturgy', (req, res) => {
  const date = req.query.date;
  
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required (format: DD/MM/YYYY)' });
  }
  
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use DD/MM/YYYY' });
  }
  
  try {
    const data = getLiturgyForDate(date);
    res.json(data);
  } catch (error) {
    console.error('Error fetching liturgy:', error);
    res.status(500).json({ error: 'Failed to fetch liturgy data' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Liturgy API server is running' });
});

app.listen(PORT, () => {
  console.log(`Liturgy API server running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/liturgy?date=09/12/2025`);
});
