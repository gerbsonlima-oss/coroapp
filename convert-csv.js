import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const csvPath = 'C:\\Users\\gerbsonlima\\Downloads\\quiz_100_perguntas_expandidas.csv';
const outputPath = path.join(__dirname, 'public', 'quiz-data.json');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

const questions = [];

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  
  if (parts.length < 7) continue;
  
  const question = {
    text: parts[0].trim(),
    options: {
      A: parts[1].trim(),
      B: parts[2].trim(),
      C: parts[3].trim(),
      D: parts[4].trim()
    },
    correct: parts[5].trim(),
    explanation: parts[6].trim()
  };
  
  questions.push(question);
}

fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));
console.log(`Converted ${questions.length} questions`);
