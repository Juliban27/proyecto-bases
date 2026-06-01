from django.db import migrations


TRIGGERS_SQL = """
-- TRIGGER 1: Al registrar un ticket, marcar el espacio como Ocupado
CREATE TRIGGER IF NOT EXISTS trg_ocupar_espacio
AFTER INSERT ON api_ticket
FOR EACH ROW
WHEN NEW.id_espacio_id IS NOT NULL
BEGIN
    UPDATE api_espacio
    SET estado = 'Ocupado'
    WHERE id_espacio = NEW.id_espacio_id;
END;

-- TRIGGER 2: Al registrar un pago, liberar el espacio y cerrar el ticket
CREATE TRIGGER IF NOT EXISTS trg_liberar_espacio_al_pagar
AFTER INSERT ON api_pago
FOR EACH ROW
BEGIN
    UPDATE api_espacio
    SET estado = 'Libre'
    WHERE id_espacio = (
        SELECT id_espacio_id FROM api_ticket WHERE id_ticket = NEW.id_ticket_id
    );

    UPDATE api_ticket
    SET estado = 'Pagado',
        fecha_salida = DATETIME('now')
    WHERE id_ticket = NEW.id_ticket_id
      AND fecha_salida IS NULL;
END;

-- TRIGGER 3: Evitar insertar un ticket en un espacio ya ocupado
CREATE TRIGGER IF NOT EXISTS trg_validar_espacio_libre
BEFORE INSERT ON api_ticket
FOR EACH ROW
WHEN NEW.id_espacio_id IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'El espacio ya está ocupado')
    WHERE (
        SELECT estado FROM api_espacio WHERE id_espacio = NEW.id_espacio_id
    ) = 'Ocupado';
END;
"""

VISTAS_SQL = """
-- VISTA 1: Ocupación actual del parqueadero
CREATE VIEW IF NOT EXISTS vista_ocupacion_actual AS
SELECT
    e.id_espacio,
    e.codigo,
    e.estado,
    e.tipo_ubicacion,
    t.id_ticket,
    t.fecha_entrada,
    v.placa,
    v.marca,
    v.color,
    v.tipo AS tipo_vehiculo,
    c.nombre AS cliente,
    c.tipo_cliente,
    tar.nombre AS tarifa_nombre,
    tar.valor AS tarifa_valor,
    tar.unidad_tiempo
FROM api_espacio e
LEFT JOIN api_ticket t
    ON t.id_espacio_id = e.id_espacio AND t.estado = 'Activo'
LEFT JOIN api_vehiculo v
    ON v.placa = t.placa_id
LEFT JOIN api_cliente c
    ON c.id_cliente = v.id_cliente_id
LEFT JOIN api_tarifa tar
    ON tar.id_tarifa = t.id_tarifa_id;

-- VISTA 2: Resumen de ingresos por día
CREATE VIEW IF NOT EXISTS vista_ingresos_diarios AS
SELECT
    DATE(p.fecha_pago) AS fecha,
    COUNT(p.id_pago)   AS total_pagos,
    SUM(p.total)       AS ingresos_total,
    AVG(p.total)       AS promedio_por_pago
FROM api_pago p
GROUP BY DATE(p.fecha_pago)
ORDER BY fecha DESC;

-- VISTA 3: Historial completo de tickets con toda la info
CREATE VIEW IF NOT EXISTS vista_tickets_completos AS
SELECT
    t.id_ticket,
    t.fecha_entrada,
    t.fecha_salida,
    t.estado,
    v.placa,
    v.marca,
    v.color,
    v.tipo AS tipo_vehiculo,
    c.nombre AS cliente,
    c.tipo_cliente,
    e.codigo AS espacio,
    e.tipo_ubicacion,
    tar.nombre AS tarifa,
    tar.valor AS tarifa_valor,
    tar.unidad_tiempo,
    em.nombre AS empleado,
    em.rol,
    p.total AS total_cobrado,
    p.metodo_pago,
    ROUND(
        (JULIANDAY(COALESCE(t.fecha_salida, DATETIME('now'))) - JULIANDAY(t.fecha_entrada)) * 24 * 60,
        1
    ) AS minutos_estadia
FROM api_ticket t
LEFT JOIN api_vehiculo v   ON v.placa = t.placa_id
LEFT JOIN api_cliente c    ON c.id_cliente = v.id_cliente_id
LEFT JOIN api_espacio e    ON e.id_espacio = t.id_espacio_id
LEFT JOIN api_tarifa tar   ON tar.id_tarifa = t.id_tarifa_id
LEFT JOIN api_empleado em  ON em.id_empleado = t.id_empleado_id
LEFT JOIN api_pago p       ON p.id_ticket_id = t.id_ticket;

-- VISTA 4: Ranking de espacios más usados
CREATE VIEW IF NOT EXISTS vista_uso_espacios AS
SELECT
    e.codigo,
    e.tipo_ubicacion,
    COUNT(t.id_ticket) AS total_tickets,
    SUM(COALESCE(p.total, 0)) AS ingresos_generados,
    ROUND(AVG(
        (JULIANDAY(COALESCE(t.fecha_salida, DATETIME('now'))) - JULIANDAY(t.fecha_entrada)) * 24 * 60
    ), 1) AS promedio_minutos
FROM api_espacio e
LEFT JOIN api_ticket t ON t.id_espacio_id = e.id_espacio
LEFT JOIN api_pago p   ON p.id_ticket_id = t.id_ticket
GROUP BY e.id_espacio, e.codigo, e.tipo_ubicacion
ORDER BY total_tickets DESC;
"""

DROP_TRIGGERS = """
DROP TRIGGER IF EXISTS trg_ocupar_espacio;
DROP TRIGGER IF EXISTS trg_liberar_espacio_al_pagar;
DROP TRIGGER IF EXISTS trg_validar_espacio_libre;
"""

DROP_VISTAS = """
DROP VIEW IF EXISTS vista_ocupacion_actual;
DROP VIEW IF EXISTS vista_ingresos_diarios;
DROP VIEW IF EXISTS vista_tickets_completos;
DROP VIEW IF EXISTS vista_uso_espacios;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_alter_cliente_telefono'),
    ]

    operations = [
        migrations.RunSQL(sql=TRIGGERS_SQL, reverse_sql=DROP_TRIGGERS),
        migrations.RunSQL(sql=VISTAS_SQL,   reverse_sql=DROP_VISTAS),
    ]
