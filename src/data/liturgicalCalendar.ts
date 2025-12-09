export interface LiturgicalDay {
  date: string;
  month: number;
  day: number;
  year: number;
  dayOfWeek: string;
  liturgicalSeason: string;
  saint: string;
  celebration: string;
}

export const liturgicalCalendar: LiturgicalDay[] = [
  { date: "2025-11-30", month: 11, day: 30, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo I do Advento", celebration: "Domingo" },
  { date: "2025-12-01", month: 12, day: 1, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2025-12-02", month: 12, day: 2, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Santa Luzia, virgem e mártir", celebration: "Memória" },
  { date: "2025-12-03", month: 12, day: 3, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2025-12-04", month: 12, day: 4, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "São João Damasceno", celebration: "Memória" },
  { date: "2025-12-05", month: 12, day: 5, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2025-12-06", month: 12, day: 6, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Sábado da Semana I do Advento", celebration: "Féria" },
  { date: "2025-12-07", month: 12, day: 7, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo II do Advento", celebration: "Domingo" },
  { date: "2025-12-08", month: 12, day: 8, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Imaculada Conceição da Virgem Santa Maria", celebration: "Solenidade" },
  { date: "2025-12-09", month: 12, day: 9, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2025-12-10", month: 12, day: 10, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2025-12-11", month: 12, day: 11, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "São Damaso I, papa", celebration: "Memória" },
  { date: "2025-12-12", month: 12, day: 12, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2025-12-13", month: 12, day: 13, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Santa Luzia de Siracusa", celebration: "Memória" },
  { date: "2025-12-14", month: 12, day: 14, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo III do Advento (Gaudete)", celebration: "Domingo" },
  { date: "2025-12-15", month: 12, day: 15, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-16", month: 12, day: 16, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-17", month: 12, day: 17, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-18", month: 12, day: 18, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "Quinta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-19", month: 12, day: 19, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-20", month: 12, day: 20, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Sábado da Semana III do Advento", celebration: "Féria" },
  { date: "2025-12-21", month: 12, day: 21, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo IV do Advento", celebration: "Domingo" },
  { date: "2025-12-22", month: 12, day: 22, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2025-12-23", month: 12, day: 23, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2025-12-24", month: 12, day: 24, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2025-12-25", month: 12, day: 25, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Natal do Senhor", celebration: "Solenidade" },
  { date: "2025-12-26", month: 12, day: 26, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Santo Estêvão, Proto-Mártir", celebration: "Festa" },
  { date: "2025-12-27", month: 12, day: 27, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo do Natal", saint: "São João Apóstolo", celebration: "Festa" },
  { date: "2025-12-28", month: 12, day: 28, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo do Natal", saint: "Santos Inocentes, Mártires", celebration: "Festa" },
  { date: "2025-12-29", month: 12, day: 29, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo do Natal", saint: "Segunda-Feira da Oitava do Natal", celebration: "Féria" },
  { date: "2025-12-30", month: 12, day: 30, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo do Natal", saint: "Terça-Feira da Oitava do Natal", celebration: "Féria" },
  { date: "2025-12-31", month: 12, day: 31, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo do Natal", saint: "São Silvestre Papa", celebration: "Memória" },
  { date: "2025-01-01", month: 1, day: 1, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Santa Maria, Mãe de Deus", celebration: "Solenidade" },
  { date: "2025-01-02", month: 1, day: 2, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo do Natal", saint: "São Basílio Magno e São Gregório de Nazianzo", celebration: "Memória Facultativa" },
  { date: "2025-01-03", month: 1, day: 3, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Sexta-Feira do Tempo do Natal", celebration: "Féria" },
  { date: "2025-01-04", month: 1, day: 4, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo do Natal", saint: "Sábado do Tempo do Natal", celebration: "Féria" },
  { date: "2025-01-05", month: 1, day: 5, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo do Natal", saint: "Domingo II do Natal", celebration: "Domingo" },
  { date: "2025-01-06", month: 1, day: 6, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo do Natal", saint: "Epifania do Senhor", celebration: "Solenidade" },
  { date: "2025-01-12", month: 1, day: 12, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Baptismo do Senhor", celebration: "Festa" },
  { date: "2025-01-13", month: 1, day: 13, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "Segunda-Feira da Semana I", celebration: "Féria" },
  { date: "2025-01-19", month: 1, day: 19, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo II do Tempo Comum", celebration: "Domingo" },
  { date: "2025-01-25", month: 1, day: 25, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "Conversão de São Paulo", celebration: "Festa" },
  { date: "2025-01-26", month: 1, day: 26, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo III do Tempo Comum", celebration: "Domingo" },
  { date: "2025-01-31", month: 1, day: 31, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "São João Bosco", celebration: "Memória" },
  { date: "2025-02-02", month: 2, day: 2, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Apresentação do Senhor", celebration: "Festa" },
  { date: "2025-02-09", month: 2, day: 9, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo V do Tempo Comum", celebration: "Domingo" },
  { date: "2025-02-16", month: 2, day: 16, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo VI do Tempo Comum", celebration: "Domingo" },
  { date: "2025-02-22", month: 2, day: 22, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "Cadeira de São Pedro", celebration: "Festa" },
  { date: "2025-02-23", month: 2, day: 23, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo VII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-03-02", month: 3, day: 2, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo VIII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-03-05", month: 3, day: 5, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Quaresma", saint: "Quarta-Feira de Cinzas", celebration: "Féria" },
  { date: "2025-03-09", month: 3, day: 9, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo I da Quaresma", celebration: "Domingo" },
  { date: "2025-03-16", month: 3, day: 16, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo II da Quaresma", celebration: "Domingo" },
  { date: "2025-03-19", month: 3, day: 19, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Quaresma", saint: "São José", celebration: "Solenidade" },
  { date: "2025-03-23", month: 3, day: 23, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo III da Quaresma", celebration: "Domingo" },
  { date: "2025-03-25", month: 3, day: 25, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Quaresma", saint: "Anunciação do Senhor", celebration: "Solenidade" },
  { date: "2025-03-30", month: 3, day: 30, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo IV da Quaresma", celebration: "Domingo" },
  { date: "2025-04-06", month: 4, day: 6, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo V da Quaresma", celebration: "Domingo" },
  { date: "2025-04-13", month: 4, day: 13, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo de Ramos e da Paixão", celebration: "Domingo" },
  { date: "2025-04-17", month: 4, day: 17, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Semana Santa", saint: "Quinta-Feira da Ceia do Senhor", celebration: "Solenidade" },
  { date: "2025-04-18", month: 4, day: 18, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Semana Santa", saint: "Sexta-Feira da Paixão", celebration: "Solenidade" },
  { date: "2025-04-19", month: 4, day: 19, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Semana Santa", saint: "Sábado Santo", celebration: "Solenidade" },
  { date: "2025-04-20", month: 4, day: 20, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo de Páscoa da Ressurreição", celebration: "Solenidade" },
  { date: "2025-04-27", month: 4, day: 27, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo II da Páscoa", celebration: "Domingo" },
  { date: "2025-05-01", month: 5, day: 1, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo Pascal", saint: "São José Operário", celebration: "Memória" },
  { date: "2025-05-04", month: 5, day: 4, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo III da Páscoa", celebration: "Domingo" },
  { date: "2025-05-11", month: 5, day: 11, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo IV da Páscoa", celebration: "Domingo" },
  { date: "2025-05-18", month: 5, day: 18, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo V da Páscoa", celebration: "Domingo" },
  { date: "2025-05-25", month: 5, day: 25, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo VI da Páscoa", celebration: "Domingo" },
  { date: "2025-05-31", month: 5, day: 31, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Pascal", saint: "Visitação da Nossa Senhora", celebration: "Festa" },
  { date: "2025-06-01", month: 6, day: 1, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Ascensão do Senhor", celebration: "Solenidade" },
  { date: "2025-06-08", month: 6, day: 8, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Domingo de Pentecostes", celebration: "Solenidade" },
  { date: "2025-06-15", month: 6, day: 15, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Santíssima Trindade", celebration: "Solenidade" },
  { date: "2025-06-22", month: 6, day: 22, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Santíssimo Corpo e Sangue de Cristo", celebration: "Solenidade" },
  { date: "2025-06-24", month: 6, day: 24, year: 2025, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo Comum", saint: "Nascimento de São João Batista", celebration: "Solenidade" },
  { date: "2025-06-29", month: 6, day: 29, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "São Pedro e São Paulo", celebration: "Solenidade" },
  { date: "2025-07-06", month: 7, day: 6, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XIV do Tempo Comum", celebration: "Domingo" },
  { date: "2025-07-13", month: 7, day: 13, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XV do Tempo Comum", celebration: "Domingo" },
  { date: "2025-07-20", month: 7, day: 20, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XVI do Tempo Comum", celebration: "Domingo" },
  { date: "2025-07-25", month: 7, day: 25, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "São Tiago Apóstolo", celebration: "Festa" },
  { date: "2025-07-27", month: 7, day: 27, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XVII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-08-03", month: 8, day: 3, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XVIII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-08-06", month: 8, day: 6, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Transfiguração do Senhor", celebration: "Festa" },
  { date: "2025-08-10", month: 8, day: 10, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XIX do Tempo Comum", celebration: "Domingo" },
  { date: "2025-08-15", month: 8, day: 15, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "Assunção da Nossa Senhora", celebration: "Solenidade" },
  { date: "2025-08-17", month: 8, day: 17, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XX do Tempo Comum", celebration: "Domingo" },
  { date: "2025-08-24", month: 8, day: 24, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXI do Tempo Comum", celebration: "Domingo" },
  { date: "2025-08-28", month: 8, day: 28, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo Comum", saint: "Santo Agostinho", celebration: "Memória" },
  { date: "2025-08-29", month: 8, day: 29, year: 2025, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "Martírio de São João Batista", celebration: "Memória" },
  { date: "2025-08-31", month: 8, day: 31, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-09-07", month: 9, day: 7, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXIII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-09-14", month: 9, day: 14, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Exaltação da Santa Cruz", celebration: "Festa" },
  { date: "2025-09-21", month: 9, day: 21, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXV do Tempo Comum", celebration: "Domingo" },
  { date: "2025-09-29", month: 9, day: 29, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "São Miguel Arcanjo", celebration: "Festa" },
  { date: "2025-09-28", month: 9, day: 28, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXVI do Tempo Comum", celebration: "Domingo" },
  { date: "2025-10-01", month: 10, day: 1, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Santa Teresa de Ávila", celebration: "Memória" },
  { date: "2025-10-05", month: 10, day: 5, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXVII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-10-12", month: 10, day: 12, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXVIII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-10-15", month: 10, day: 15, year: 2025, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Santa Teresa de Ávila", celebration: "Memória" },
  { date: "2025-10-19", month: 10, day: 19, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXIX do Tempo Comum", celebration: "Domingo" },
  { date: "2025-10-26", month: 10, day: 26, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXX do Tempo Comum", celebration: "Domingo" },
  { date: "2025-11-01", month: 11, day: 1, year: 2025, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "Todos os Santos", celebration: "Solenidade" },
  { date: "2025-11-02", month: 11, day: 2, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Finados - Comemoração de Todos os Fiéis Defuntos", celebration: "Comemoração" },
  { date: "2025-11-09", month: 11, day: 9, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Dedicação da Basílica de Latrão", celebration: "Festa" },
  { date: "2025-11-16", month: 11, day: 16, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo XXXIII do Tempo Comum", celebration: "Domingo" },
  { date: "2025-11-23", month: 11, day: 23, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Cristo Rei do Universo", celebration: "Solenidade" },
  { date: "2025-11-30", month: 11, day: 30, year: 2025, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Santo André Apóstolo", celebration: "Festa" },
  { date: "2025-12-08", month: 12, day: 8, year: 2025, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Imaculada Conceição", celebration: "Solenidade" },
  { date: "2025-12-25", month: 12, day: 25, year: 2025, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Natal do Senhor", celebration: "Solenidade" },
  { date: "2026-01-01", month: 1, day: 1, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Santa Maria, Mãe de Deus", celebration: "Solenidade" },
  { date: "2026-01-02", month: 1, day: 2, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Santos Basílio Magno e Gregório de Nazianzo", celebration: "Memória" },
  { date: "2026-01-03", month: 1, day: 3, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo do Natal", saint: "Santíssimo Nome de Jesus", celebration: "Memória Facultativa" },
  { date: "2026-01-04", month: 1, day: 4, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo do Natal", saint: "Domingo II do Natal", celebration: "Domingo" },
  { date: "2026-01-05", month: 1, day: 5, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo do Natal", saint: "Segunda-Feira do Tempo do Natal", celebration: "Féria" },
  { date: "2026-01-06", month: 1, day: 6, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo do Natal", saint: "Epifania do Senhor", celebration: "Solenidade" },
  { date: "2026-01-07", month: 1, day: 7, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo do Natal", saint: "São Raimundo de Peñafort", celebration: "Memória Facultativa" },
  { date: "2026-01-08", month: 1, day: 8, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Quinta-Feira depois da Epifania", celebration: "Féria" },
  { date: "2026-01-09", month: 1, day: 9, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Sexta-Feira depois da Epifania", celebration: "Féria" },
  { date: "2026-01-10", month: 1, day: 10, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo do Natal", saint: "Sábado depois da Epifania", celebration: "Féria" },
  { date: "2026-01-11", month: 1, day: 11, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Baptismo do Senhor", celebration: "Festa" },
  { date: "2026-01-12", month: 1, day: 12, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "Segunda-Feira da Semana I do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-13", month: 1, day: 13, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo Comum", saint: "Santo Hilário", celebration: "Memória Facultativa" },
  { date: "2026-01-14", month: 1, day: 14, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Quarta-Feira da Semana I do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-15", month: 1, day: 15, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo Comum", saint: "Quinta-Feira da Semana I do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-16", month: 1, day: 16, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "Sexta-Feira da Semana I do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-17", month: 1, day: 17, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "Santo Antão", celebration: "Memória" },
  { date: "2026-01-18", month: 1, day: 18, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo II do Tempo Comum", celebration: "Domingo" },
  { date: "2026-01-19", month: 1, day: 19, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "Segunda-Feira da Semana II do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-20", month: 1, day: 20, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo Comum", saint: "São Fabião e São Sebastião", celebration: "Memória Facultativa" },
  { date: "2026-01-21", month: 1, day: 21, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Santa Inês", celebration: "Memória" },
  { date: "2026-01-22", month: 1, day: 22, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo Comum", saint: "São Vicente", celebration: "Memória Facultativa" },
  { date: "2026-01-23", month: 1, day: 23, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "Sexta-Feira da Semana II do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-24", month: 1, day: 24, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "São Francisco de Sales", celebration: "Memória" },
  { date: "2026-01-25", month: 1, day: 25, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Domingo III do Tempo Comum", celebration: "Domingo" },
  { date: "2026-01-26", month: 1, day: 26, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "Santos Timóteo e Tito", celebration: "Memória" },
  { date: "2026-01-27", month: 1, day: 27, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Tempo Comum", saint: "Santa Ângela Merici", celebration: "Memória Facultativa" },
  { date: "2026-01-28", month: 1, day: 28, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "São Tomás de Aquino", celebration: "Memória" },
  { date: "2026-01-29", month: 1, day: 29, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Tempo Comum", saint: "Quinta-Feira da Semana III do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-30", month: 1, day: 30, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo Comum", saint: "Sexta-Feira da Semana III do Tempo Comum", celebration: "Féria" },
  { date: "2026-01-31", month: 1, day: 31, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "São João Bosco", celebration: "Memória" },
  { date: "2026-02-02", month: 2, day: 2, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "Apresentação do Senhor", celebration: "Festa" },
  { date: "2026-02-18", month: 2, day: 18, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Quaresma", saint: "Quarta-Feira de Cinzas", celebration: "Féria" },
  { date: "2026-03-25", month: 3, day: 25, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Quaresma", saint: "Anunciação do Senhor", celebration: "Solenidade" },
  { date: "2026-03-29", month: 3, day: 29, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Quaresma", saint: "Domingo de Ramos", celebration: "Domingo" },
  { date: "2026-04-02", month: 4, day: 2, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Semana Santa", saint: "Quinta-Feira da Ceia do Senhor", celebration: "Solenidade" },
  { date: "2026-04-03", month: 4, day: 3, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Semana Santa", saint: "Sexta-Feira da Paixão", celebration: "Solenidade" },
  { date: "2026-04-05", month: 4, day: 5, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Páscoa da Ressurreição", celebration: "Solenidade" },
  { date: "2026-05-17", month: 5, day: 17, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Ascensão do Senhor", celebration: "Solenidade" },
  { date: "2026-05-24", month: 5, day: 24, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Pascal", saint: "Pentecostes", celebration: "Solenidade" },
  { date: "2026-05-31", month: 5, day: 31, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Santíssima Trindade", celebration: "Solenidade" },
  { date: "2026-06-07", month: 6, day: 7, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Corpus Christi", celebration: "Solenidade" },
  { date: "2026-06-24", month: 6, day: 24, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Tempo Comum", saint: "Nascimento de São João Batista", celebration: "Solenidade" },
  { date: "2026-06-29", month: 6, day: 29, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Tempo Comum", saint: "São Pedro e São Paulo", celebration: "Solenidade" },
  { date: "2026-08-15", month: 8, day: 15, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Tempo Comum", saint: "Assunção da Nossa Senhora", celebration: "Solenidade" },
  { date: "2026-11-01", month: 11, day: 1, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Tempo Comum", saint: "Todos os Santos", celebration: "Solenidade" },
  { date: "2026-11-29", month: 11, day: 29, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo I do Advento", celebration: "Domingo" },
  { date: "2026-11-30", month: 11, day: 30, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2026-12-01", month: 12, day: 1, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2026-12-02", month: 12, day: 2, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2026-12-03", month: 12, day: 3, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "São Francisco Xavier", celebration: "Memória" },
  { date: "2026-12-04", month: 12, day: 4, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana I do Advento", celebration: "Féria" },
  { date: "2026-12-05", month: 12, day: 5, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Sábado da Semana I do Advento", celebration: "Féria" },
  { date: "2026-12-06", month: 12, day: 6, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo II do Advento", celebration: "Domingo" },
  { date: "2026-12-07", month: 12, day: 7, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2026-12-08", month: 12, day: 8, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Imaculada Conceição da Virgem Santa Maria", celebration: "Solenidade" },
  { date: "2026-12-09", month: 12, day: 9, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2026-12-10", month: 12, day: 10, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "Quinta-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2026-12-11", month: 12, day: 11, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana II do Advento", celebration: "Féria" },
  { date: "2026-12-12", month: 12, day: 12, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Sábado da Semana II do Advento", celebration: "Féria" },
  { date: "2026-12-13", month: 12, day: 13, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo III do Advento (Gaudete)", celebration: "Domingo" },
  { date: "2026-12-14", month: 12, day: 14, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-15", month: 12, day: 15, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-16", month: 12, day: 16, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-17", month: 12, day: 17, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "Quinta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-18", month: 12, day: 18, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Advento", saint: "Sexta-Feira da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-19", month: 12, day: 19, year: 2026, dayOfWeek: "Sábado", liturgicalSeason: "Advento", saint: "Sábado da Semana III do Advento", celebration: "Féria" },
  { date: "2026-12-20", month: 12, day: 20, year: 2026, dayOfWeek: "Domingo", liturgicalSeason: "Advento", saint: "Domingo IV do Advento", celebration: "Domingo" },
  { date: "2026-12-21", month: 12, day: 21, year: 2026, dayOfWeek: "Segunda-Feira", liturgicalSeason: "Advento", saint: "Segunda-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2026-12-22", month: 12, day: 22, year: 2026, dayOfWeek: "Terça-Feira", liturgicalSeason: "Advento", saint: "Terça-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2026-12-23", month: 12, day: 23, year: 2026, dayOfWeek: "Quarta-Feira", liturgicalSeason: "Advento", saint: "Quarta-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2026-12-24", month: 12, day: 24, year: 2026, dayOfWeek: "Quinta-Feira", liturgicalSeason: "Advento", saint: "Quinta-Feira da Semana IV do Advento", celebration: "Féria" },
  { date: "2026-12-25", month: 12, day: 25, year: 2026, dayOfWeek: "Sexta-Feira", liturgicalSeason: "Tempo do Natal", saint: "Natal do Senhor", celebration: "Solenidade" },
];

export function getLiturgicalDay(date: Date): LiturgicalDay | undefined {
  const dateStr = date.toISOString().split('T')[0];
  const exactMatch = liturgicalCalendar.find(day => day.date === dateStr);
  
  if (exactMatch) return exactMatch;
  
  // Se não encontrar data exata, retorna um dia genérico
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  
  return {
    date: dateStr,
    month,
    day,
    year,
    dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
    liturgicalSeason: 'Tempo Comum',
    saint: 'Festa do Senhor',
    celebration: 'Féria',
  };
}

export function getNextLiturgicalDays(date: Date, count: number = 7): LiturgicalDay[] {
  const dateStr = date.toISOString().split('T')[0];
  const currentIndex = liturgicalCalendar.findIndex(day => day.date === dateStr);
  
  if (currentIndex === -1) {
    // Se não encontrar, retorna próximos dias genéricos
    const nextDays: LiturgicalDay[] = [];
    for (let i = 1; i <= count; i++) {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + i);
      const found = getLiturgicalDay(nextDate);
      if (found) nextDays.push(found);
    }
    return nextDays;
  }
  
  return liturgicalCalendar.slice(currentIndex + 1, currentIndex + 1 + count);
}
