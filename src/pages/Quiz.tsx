import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ChevronRight, Sparkles, RotateCcw } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

const FEEDBACK_MESSAGES = [
  { correct: true, messages: ['🎉 Perfeito!', '✨ Você acertou!', '🌟 Excelente!', '🏆 Que máximo!', '💪 Muito bom!', '🎊 Sensacional!'] },
  { correct: false, messages: ['😢 Errou dessa vez!', '🤔 Quase lá!', '📚 Vamos estudar mais!', '💭 Tente novamente!', '🎯 Próxima vez acerta!', '📖 Boa tentativa!'] }
];

const QUESTIONS_PER_SESSION = 10;

const Quiz = () => {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch('/quiz-data.json');
        const data = await response.json() as Array<{text: string; options: {A: string; B: string; C: string; D: string}; correct: string; explanation: string}>;
        
        const parsed: Question[] = data.map((item, index) => ({
          id: index + 1,
          text: item.text,
          options: item.options,
          correct: item.correct as 'A' | 'B' | 'C' | 'D',
          explanation: item.explanation
        }));
        
        setAllQuestions(parsed);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar quiz:', error);
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const currentQuestion = sessionQuestions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correct;

  const handleAnswerClick = (answer: 'A' | 'B' | 'C' | 'D') => {
    if (showResult) return;
    
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const correct = answer === currentQuestion.correct;
    if (correct) {
      setScore(score + 1);
    }
    
    const messagePool = correct 
      ? FEEDBACK_MESSAGES[0].messages 
      : FEEDBACK_MESSAGES[1].messages;
    const randomMessage = messagePool[Math.floor(Math.random() * messagePool.length)];
    
    setFeedback({
      text: randomMessage,
      isCorrect: correct
    });
    
    setTotalAnswered(totalAnswered + 1);
  };

  const handleNext = () => {
    setCurrentIndex(currentIndex + 1);
    setSelectedAnswer(null);
    setShowResult(false);
    setFeedback(null);
  };

  const selectRandomQuestions = () => {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, QUESTIONS_PER_SESSION);
  };

  const startQuiz = () => {
    const selected = selectRandomQuestions();
    setSessionQuestions(selected);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setTotalAnswered(0);
    setFeedback(null);
    setQuizStarted(true);
  };

  const handleRestart = () => {
    const selected = selectRandomQuestions();
    setSessionQuestions(selected);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setTotalAnswered(0);
    setFeedback(null);
    setQuizStarted(true);
  };

  const getAnswerButtonColor = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!showResult) {
      return selectedAnswer === option 
        ? 'bg-primary text-white' 
        : 'bg-secondary hover:bg-secondary/80';
    }
    
    if (option === currentQuestion?.correct) {
      return 'bg-green-500 text-white animate-pulse';
    }
    
    if (option === selectedAnswer && !isCorrect) {
      return 'bg-red-500 text-white animate-pulse';
    }
    
    return 'bg-secondary opacity-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/50 flex items-center justify-center pb-32">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando perguntas...</p>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/50 flex items-center justify-center pb-32 px-4">
        <Card className="w-full max-w-md p-8 space-y-6 border-0 shadow-lg">
          <div className="text-center space-y-3">
            <div className="text-5xl">✨</div>
            <h1 className="text-3xl font-bold">Quiz Litúrgico</h1>
            <p className="text-muted-foreground">Teste seus conhecimentos sobre a Missa</p>
          </div>

          <div className="bg-primary/10 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-primary">📚 {QUESTIONS_PER_SESSION} perguntas por sessão</p>
            <p className="text-sm text-muted-foreground">Desafie-se a responder corretamente e aprenda mais sobre nossa fé!</p>
          </div>

          <Button 
            onClick={startQuiz}
            className="w-full h-12 text-lg font-semibold"
          >
            Começar Quiz
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </Card>
        <BottomNavigation />
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/50 flex items-center justify-center pb-32 px-4">
        <Card className="w-full max-w-md p-8 space-y-6 border-0 shadow-lg text-center">
          <div className="text-6xl">🏆</div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Parabéns!</h2>
            <p className="text-muted-foreground">Você completou o quiz!</p>
          </div>

          <div className="bg-primary/10 rounded-lg p-6 space-y-3">
            <div>
              <p className="text-5xl font-bold text-primary">{Math.round((score / QUESTIONS_PER_SESSION) * 100)}%</p>
              <p className="text-sm text-muted-foreground">Taxa de acertos</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-lg font-semibold">{score} de {QUESTIONS_PER_SESSION}</p>
              <p className="text-sm text-muted-foreground">Respostas corretas</p>
            </div>
          </div>

          <Button 
            onClick={handleRestart}
            className="w-full h-12 text-lg font-semibold"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Tentar Novamente
          </Button>
        </Card>
        <BottomNavigation />
      </div>
    );
  }

  const progress = ((currentIndex + 1) / QUESTIONS_PER_SESSION) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50 pb-32">
      <div className="sticky top-0 bg-gradient-to-r from-primary to-primary/80 text-white p-4 shadow-lg z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">{score} acertos</span>
            </div>
            <span className="text-sm font-medium">{currentIndex + 1} de {QUESTIONS_PER_SESSION}</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-white h-full transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pergunta e Opções */}
          <Card className="p-6 border-0 shadow-lg h-fit">
            <h2 className="text-lg font-bold mb-6 leading-relaxed text-foreground">
              {currentQuestion.text}
            </h2>

            <div className="space-y-3">
              {(['A', 'B', 'C', 'D'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswerClick(option)}
                  disabled={showResult}
                  className={`w-full text-left p-3 rounded-lg font-semibold transition-all border-2 border-transparent hover:border-primary/50 disabled:cursor-default text-sm ${getAnswerButtonColor(option)}`}
                >
                  <span className="inline-block w-7 h-7 rounded-full bg-white/20 text-center leading-7 mr-2 text-xs">
                    {option}
                  </span>
                  {currentQuestion.options[option]}
                </button>
              ))}
            </div>
          </Card>

          {/* Resultado e Explicação */}
          <div className="space-y-6">
            {showResult && feedback && (
              <div className={`animate-in fade-in zoom-in-95 duration-300 p-6 rounded-lg border-2 shadow-lg ${
                feedback.isCorrect 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="space-y-4">
                  <p className="text-2xl font-bold text-center">
                    {feedback.text}
                  </p>
                  <div className="bg-white/50 rounded p-4">
                    <p className="text-sm font-semibold mb-2">Resposta correta:</p>
                    <p className="text-foreground font-medium text-base">
                      {currentQuestion.options[currentQuestion.correct]}
                    </p>
                  </div>
                  <div className="bg-primary/5 rounded p-4 border border-primary/20 max-h-32 overflow-y-auto">
                    <p className="text-sm font-semibold mb-2">📚 Explicação:</p>
                    <p className="text-foreground text-sm leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showResult && (
              <Button 
                onClick={handleNext}
                className="w-full h-11 text-base font-semibold"
              >
                {currentIndex >= QUESTIONS_PER_SESSION - 1 ? 'Finalizar Quiz' : 'Próxima'}
                {currentIndex < QUESTIONS_PER_SESSION - 1 && <ChevronRight className="ml-2 h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Quiz;
