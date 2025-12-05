-- Atualizar constraint de tipos de música para aceitar novos tipos litúrgicos
ALTER TABLE songs DROP CONSTRAINT songs_type_check;

ALTER TABLE songs ADD CONSTRAINT songs_type_check CHECK (
  type IN (
    -- Tipos católicos novos
    'canto_entrada',
    'ato_penitencial',
    'gloria',
    'salmo',
    'aclamacao',
    'oferendas',
    'santo',
    'cordeiro',
    'comunhao',
    'acao_gracas',
    'final',
    -- Tipos antigos para retrocompatibilidade
    'entrada',
    'perdao',
    'ofertorio',
    'outro'
  )
);