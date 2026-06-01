import math
from decimal import Decimal
from django.utils import timezone
from django.db import models as db_models, connection
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Cliente, Vehiculo, Empleado, Espacio, Tarifa, Ticket, Pago
from .serializers import (
    ClienteSerializer, VehiculoSerializer, EmpleadoSerializer,
    EspacioSerializer, TarifaSerializer, TicketSerializer, PagoSerializer
)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all().order_by('nombre')
    serializer_class = ClienteSerializer

    @action(detail=True, methods=['get'])
    def vehiculos(self, request, pk=None):
        cliente = self.get_object()
        vehiculos = cliente.vehiculos.all()
        return Response(VehiculoSerializer(vehiculos, many=True).data)


class VehiculoViewSet(viewsets.ModelViewSet):
    queryset = Vehiculo.objects.all().select_related('id_cliente')
    serializer_class = VehiculoSerializer


class EmpleadoViewSet(viewsets.ModelViewSet):
    queryset = Empleado.objects.all().order_by('nombre')
    serializer_class = EmpleadoSerializer


class EspacioViewSet(viewsets.ModelViewSet):
    queryset = Espacio.objects.all().order_by('codigo')
    serializer_class = EspacioSerializer

    @action(detail=False, methods=['get'])
    def libres(self, request):
        espacios = Espacio.objects.filter(estado='Libre').order_by('codigo')
        return Response(EspacioSerializer(espacios, many=True).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        total = Espacio.objects.count()
        libres = Espacio.objects.filter(estado='Libre').count()
        ocupados = Espacio.objects.filter(estado='Ocupado').count()
        hoy = timezone.now().date()
        tickets_hoy = Ticket.objects.filter(fecha_entrada__date=hoy).count()
        ingresos_hoy = Pago.objects.filter(
            fecha_pago__date=hoy
        ).aggregate(total=db_models.Sum('total'))['total'] or Decimal('0')
        tickets_activos = Ticket.objects.filter(estado='Activo').count()
        return Response({
            'total': total,
            'libres': libres,
            'ocupados': ocupados,
            'tickets_hoy': tickets_hoy,
            'tickets_activos': tickets_activos,
            'ingresos_hoy': float(ingresos_hoy),
        })


class TarifaViewSet(viewsets.ModelViewSet):
    queryset = Tarifa.objects.all()
    serializer_class = TarifaSerializer


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all().select_related(
        'placa', 'placa__id_cliente', 'id_espacio', 'id_tarifa', 'id_empleado'
    ).order_by('-fecha_entrada')
    serializer_class = TicketSerializer

    @action(detail=False, methods=['get'])
    def activos(self, request):
        tickets = Ticket.objects.filter(estado='Activo').select_related(
            'placa', 'placa__id_cliente', 'id_espacio', 'id_tarifa', 'id_empleado'
        ).order_by('-fecha_entrada')
        return Response(TicketSerializer(tickets, many=True).data)

    @action(detail=True, methods=['post'])
    def registrar_salida(self, request, pk=None):
        ticket = self.get_object()

        if ticket.estado != 'Activo':
            return Response(
                {'error': f'El ticket ya está en estado: {ticket.estado}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        metodo_pago = request.data.get('metodo_pago', 'Efectivo')
        id_tarifa_override = request.data.get('id_tarifa')
        if id_tarifa_override:
            try:
                ticket.id_tarifa = Tarifa.objects.get(pk=id_tarifa_override)
                ticket.save(update_fields=['id_tarifa'])
            except Tarifa.DoesNotExist:
                pass
        fecha_salida = timezone.now()
        duracion = fecha_salida - ticket.fecha_entrada
        horas_exactas = duracion.total_seconds() / 3600

        minutos_exactos = duracion.total_seconds() / 60

        tarifa = ticket.id_tarifa
        if tarifa:
            if tarifa.unidad_tiempo == 'minuto':
                minutos_cobrar = max(math.ceil(minutos_exactos), 1)
                total = tarifa.valor * Decimal(str(minutos_cobrar))
            elif tarifa.unidad_tiempo == 'hora':
                horas_cobrar = max(math.ceil(horas_exactas), 1)
                total = tarifa.valor * Decimal(str(horas_cobrar))
            elif tarifa.unidad_tiempo == 'dia':
                dias_cobrar = max(math.ceil(horas_exactas / 24), 1)
                total = tarifa.valor * Decimal(str(dias_cobrar))
            else:
                total = tarifa.valor
        else:
            total = Decimal('0')

        pago = Pago.objects.create(
            id_ticket=ticket,
            total=total,
            metodo_pago=metodo_pago,
        )

        return Response({
            'pago': PagoSerializer(pago).data,
            'ticket': TicketSerializer(Ticket.objects.get(pk=ticket.pk)).data,
            'duracion_horas': round(horas_exactas, 2),
            'total': float(total),
        }, status=status.HTTP_201_CREATED)


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all().select_related('id_ticket').order_by('-fecha_pago')
    serializer_class = PagoSerializer


def _query(sql, params=None):
    with connection.cursor() as cur:
        cur.execute(sql, params or [])
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


@api_view(['GET'])
def reportes(request):
    # Ingresos últimos 14 días
    ingresos_diarios = _query("""
        SELECT DATE(fecha_pago) AS fecha,
               COUNT(*)        AS pagos,
               SUM(total)      AS ingresos
        FROM api_pago
        WHERE fecha_pago >= DATE('now', '-14 days')
        GROUP BY DATE(fecha_pago)
        ORDER BY fecha ASC
    """)

    # Vehículos más frecuentes (top 8)
    vehiculos_top = _query("""
        SELECT t.placa_id              AS placa,
               v.marca,
               v.color,
               v.tipo,
               c.nombre                AS cliente,
               COUNT(t.id_ticket)      AS visitas,
               SUM(COALESCE(p.total,0)) AS total_pagado
        FROM api_ticket t
        JOIN api_vehiculo v ON v.placa = t.placa_id
        JOIN api_cliente c  ON c.id_cliente = v.id_cliente_id
        LEFT JOIN api_pago p ON p.id_ticket_id = t.id_ticket
        GROUP BY t.placa_id
        ORDER BY visitas DESC
        LIMIT 8
    """)

    # Espacios más usados (desde vista)
    uso_espacios = _query("""
        SELECT codigo, tipo_ubicacion, total_tickets, ingresos_generados, promedio_minutos
        FROM vista_uso_espacios
        LIMIT 10
    """)

    # Ingresos por método de pago
    por_metodo = _query("""
        SELECT metodo_pago,
               COUNT(*) AS pagos,
               SUM(total) AS total
        FROM api_pago
        GROUP BY metodo_pago
        ORDER BY total DESC
    """)

    # Totales generales
    totales = _query("""
        SELECT
            (SELECT COUNT(*) FROM api_ticket)                       AS total_tickets,
            (SELECT COUNT(*) FROM api_ticket WHERE estado='Activo') AS activos,
            (SELECT COUNT(*) FROM api_pago)                         AS total_pagos,
            (SELECT COALESCE(SUM(total),0) FROM api_pago)           AS ingresos_totales,
            (SELECT COUNT(*) FROM api_cliente)                      AS total_clientes,
            (SELECT COUNT(*) FROM api_vehiculo)                     AS total_vehiculos
    """)[0]

    return Response({
        'ingresos_diarios': ingresos_diarios,
        'vehiculos_top': vehiculos_top,
        'uso_espacios': uso_espacios,
        'por_metodo': por_metodo,
        'totales': totales,
    })
