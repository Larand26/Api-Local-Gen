-- Busca de produtos com filtros opcionais.
-- Todo parâmetro @... é opcional: quando vem NULL, o filtro é ignorado.
-- Os filtros de texto não diferenciam maiúsculas/minúsculas nem acentos (SANDALIA = Sandália).
-- Filtros de texto aceitam vários valores: dentro do mesmo filtro vale OU
-- (marca ZAXY ou IPANEMA) e entre filtros diferentes vale E (marca ... e gênero ...).
-- Esses parâmetros chegam como XML "<v>valor1</v><v>valor2</v>" montado pelo ProductsService
-- (o banco está em nível de compatibilidade 100, sem STRING_SPLIT/OPENJSON).
--
-- Desempenho: a consulta é feita em 3 etapas com tabelas temporárias (#), que têm estatísticas.
-- Tentativas anteriores eram lentas ou davam timeout:
--   * filtros aplicados direto no JOIN + OPTION (RECOMPILE): planos ruins (até 57s);
--   * variável de tabela (@Grupos): o otimizador estima 1 linha e escolhe um plano ruim;
--   * quebra da descrição via XML dentro do JOIN: reavaliada a cada linha.
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#Grupos') IS NOT NULL DROP TABLE #Grupos;
IF OBJECT_ID('tempdb..#ListaProdutos') IS NOT NULL DROP TABLE #ListaProdutos;
IF OBJECT_ID('tempdb..#Filtros') IS NOT NULL DROP TABLE #Filtros;

-- 0) Valores de cada filtro, um por linha: (campo, valor)
CREATE TABLE #Filtros (
    campo varchar(30) COLLATE DATABASE_DEFAULT NOT NULL,
    valor nvarchar(200) COLLATE DATABASE_DEFAULT NOT NULL
);

INSERT INTO #Filtros (campo, valor)
SELECT F.campo, LTRIM(RTRIM(V.c.value('.', 'nvarchar(200)')))
FROM (
    SELECT 'id' AS campo, CAST(@id AS XML) AS x UNION ALL
    SELECT 'barcode', CAST(@barcode AS XML) UNION ALL
    SELECT 'manufacturerCode', CAST(@manufacturerCode AS XML) UNION ALL
    SELECT 'name', CAST(@name AS XML) UNION ALL
    SELECT 'brand', CAST(@brand AS XML) UNION ALL
    SELECT 'gender', CAST(@gender AS XML) UNION ALL
    SELECT 'type', CAST(@type AS XML) UNION ALL
    SELECT 'line', CAST(@line AS XML) UNION ALL
    SELECT 'material', CAST(@material AS XML) UNION ALL
    SELECT 'color', CAST(@color AS XML) UNION ALL
    SELECT 'colorCode', CAST(@colorCode AS XML)
) F
CROSS APPLY F.x.nodes('/v') V(c);

-- 1) Grupos de produto.
-- GRUP_DESCRICAO segue a hierarquia "FABRICANTE, MARCA, GÊNERO, TIPO, LINHA, MATERIAL".
-- Cada parte é separada pela posição, porque alguns valores se repetem em posições
-- diferentes (ex.: OUTROS é marca e linha; PVC é linha e material).
-- Um mesmo grupo pode existir em mais de uma filial: priorizamos a filial 1.
WITH GruposFilial AS (
    SELECT
        G.[ID_CODGRUPO],
        G.[GRUP_DESCRICAO],
        ROW_NUMBER() OVER (
            PARTITION BY G.[ID_CODGRUPO]
            ORDER BY CASE WHEN G.[ID_CODFILIAIS] = 1 THEN 0 ELSE 1 END
        ) AS Ordem
    FROM [GrupoItens] G
)
SELECT
    GF.[ID_CODGRUPO],
    GF.[GRUP_DESCRICAO],
    CASE WHEN V.p2 > 0 THEN LTRIM(RTRIM(SUBSTRING(V.s, V.p1 + 1, V.p2 - V.p1 - 1))) END AS Marca,
    CASE WHEN V.p3 > 0 THEN LTRIM(RTRIM(SUBSTRING(V.s, V.p2 + 1, V.p3 - V.p2 - 1))) END AS Genero,
    CASE WHEN V.p4 > 0 THEN LTRIM(RTRIM(SUBSTRING(V.s, V.p3 + 1, V.p4 - V.p3 - 1))) END AS Tipo,
    CASE WHEN V.p5 > 0 THEN LTRIM(RTRIM(SUBSTRING(V.s, V.p4 + 1, V.p5 - V.p4 - 1))) END AS Linha,
    CASE WHEN V.p6 > 0 THEN LTRIM(RTRIM(SUBSTRING(V.s, V.p5 + 1, V.p6 - V.p5 - 1))) END AS Material
INTO #Grupos
FROM GruposFilial GF
-- s = ",A,B,C,D,E,F," e p1..p6 = posição da vírgula que fecha cada parte
CROSS APPLY (SELECT ',' + GF.[GRUP_DESCRICAO] + ',' AS s) S
CROSS APPLY (SELECT CHARINDEX(',', S.s, 2) AS p1) A1
CROSS APPLY (SELECT CASE WHEN A1.p1 > 0 THEN CHARINDEX(',', S.s, A1.p1 + 1) ELSE 0 END AS p2) A2
CROSS APPLY (SELECT CASE WHEN A2.p2 > 0 THEN CHARINDEX(',', S.s, A2.p2 + 1) ELSE 0 END AS p3) A3
CROSS APPLY (SELECT CASE WHEN A3.p3 > 0 THEN CHARINDEX(',', S.s, A3.p3 + 1) ELSE 0 END AS p4) A4
CROSS APPLY (SELECT CASE WHEN A4.p4 > 0 THEN CHARINDEX(',', S.s, A4.p4 + 1) ELSE 0 END AS p5) A5
CROSS APPLY (SELECT CASE WHEN A5.p5 > 0 THEN CHARINDEX(',', S.s, A5.p5 + 1) ELSE 0 END AS p6) A6
CROSS APPLY (SELECT S.s, A1.p1, A2.p2, A3.p3, A4.p4, A5.p5, A6.p6) V
WHERE GF.Ordem = 1;

CREATE UNIQUE CLUSTERED INDEX IX_Grupos ON #Grupos ([ID_CODGRUPO]);

-- 2) Lista base: depósito 2 + lista de preço 1 (poucos milhares de itens).
WITH Reservas AS (
    SELECT
        [ID_CODPRODUTO],
        SUM([EST_QUANTIDADE]) AS QuantidadeReservada
    FROM [dbo].[EST_RESERVA_PED]
    GROUP BY [ID_CODPRODUTO]
)
SELECT
    P.[ID_CODPRODUTO] AS id,
    VI.[PROD_CODFABRIC] AS manufacturer_code,
    P.[PROD_DESCABREVIADA] AS name,
    P.[PROD_CODBARRA] AS barcode,
    L.[LITABPRE_PRECO1] AS price1,
    L.[LITABPRE_PRECO2] AS price2,
    L.[LITABPRE_VALPROMOCAO] AS pricePromotion,
    PE.[CODIGO_COR] AS color_code,
    C.[DESCRICAO] AS color_description,
    VI.[ID_CODGRUPO] AS group_id,
    (VI.[PROD_ESTATUAL] - ISNULL(R.QuantidadeReservada, 0)) AS stock
INTO #ListaProdutos
FROM [PRODUTOS] P
LEFT JOIN [LISTADEPRECOS_LINHAS] L ON P.[ID_CODPRODUTO] = L.[ID_CODPRODUTO]
LEFT JOIN [PRODUTOS_ECOMERCE] PE ON P.[ID_CODPRODUTO] = PE.[ID_CODPRODUTO]
LEFT JOIN [vwITEM] VI ON P.[ID_CODPRODUTO] = VI.[ID_CODPRODUTO]
-- Os grupos NÃO entram neste JOIN: juntar #Grupos aqui faz o otimizador mudar a ordem
-- de acesso à vwITEM e a etapa passa de ~0,2s para ~47s. A junção é feita na etapa 3.
LEFT JOIN [CORES_ECOMERCE] C ON PE.[ID_CORES_ECOMERCE] = C.[ID_CHAVE]
LEFT JOIN Reservas R ON P.[ID_CODPRODUTO] = R.[ID_CODPRODUTO]
WHERE VI.[ID_DEPOSITOS] = 2
AND L.[ID_CODLISTAPRECOS] = 1;

-- 3) Grupos, filtros e paginação sobre a lista base.
SELECT
    LP.id,
    LP.manufacturer_code,
    LP.name,
    LP.barcode,
    LP.price1,
    LP.price2,
    LP.pricePromotion,
    LP.color_code,
    LP.color_description,
    G.[GRUP_DESCRICAO] AS group_description,
    G.Marca AS brand,
    G.Genero AS gender,
    G.Tipo AS type,
    G.Linha AS line,
    G.Material AS material,
    LP.stock,
    COUNT(*) OVER () AS total_count
FROM #ListaProdutos LP
INNER JOIN #Grupos G ON LP.group_id = G.[ID_CODGRUPO]
-- Códigos: comparação exata com qualquer um dos valores informados
WHERE (@id IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'id' AND LP.id = F.valor))
AND (@barcode IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'barcode' AND LP.barcode = F.valor))
AND (@manufacturerCode IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'manufacturerCode' AND LP.manufacturer_code = F.valor))
AND (@colorCode IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'colorCode' AND LP.color_code = F.valor))
-- Textos: "contém" qualquer um dos valores informados
AND (@name IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'name' AND LP.name COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@brand IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'brand' AND G.Marca COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@gender IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'gender' AND G.Genero COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@type IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'type' AND G.Tipo COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@line IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'line' AND G.Linha COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@material IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'material' AND G.Material COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@color IS NULL OR EXISTS (SELECT 1 FROM #Filtros F WHERE F.campo = 'color' AND LP.color_description COLLATE Latin1_General_CI_AI LIKE '%' + F.valor + '%'))
AND (@minStock IS NULL OR stock >= @minStock)
AND (@maxStock IS NULL OR stock <= @maxStock)
AND (@minPrice IS NULL OR price1 >= @minPrice)
AND (@maxPrice IS NULL OR price1 <= @maxPrice)
-- id é varchar: ordenar pelo tamanho antes mantém a ordem numérica
ORDER BY LEN(LP.id) DESC, LP.id DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

DROP TABLE #ListaProdutos;
DROP TABLE #Grupos;
DROP TABLE #Filtros;
