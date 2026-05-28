SELECT TOP(1)
[ID_CODENTIDADE] AS client_id,
[ENTI_RAZAOSOCIAL] AS corporate_name,
[ENTI_CNPJCPF] as client_cnpj,
[ID_CODVENDEDOR] AS salesperson_id,
[ENTI_CELULAR] AS cellphone,
[ENTI_DDD_CELULAR] AS cellphone_area_code
FROM [ENTIDADES]
WHERE [ENTI_CNPJCPF] = @cnpj