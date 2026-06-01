from rest_framework import serializers
from .models import Cliente, Vehiculo, Empleado, Espacio, Tarifa, Ticket, Pago


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'


class VehiculoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='id_cliente.nombre', read_only=True)

    class Meta:
        model = Vehiculo
        fields = '__all__'


class EmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleado
        fields = '__all__'


class EspacioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Espacio
        fields = '__all__'


class TarifaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tarifa
        fields = '__all__'


class TicketSerializer(serializers.ModelSerializer):
    placa_info = VehiculoSerializer(source='placa', read_only=True)
    espacio_info = EspacioSerializer(source='id_espacio', read_only=True)
    tarifa_info = TarifaSerializer(source='id_tarifa', read_only=True)
    empleado_info = EmpleadoSerializer(source='id_empleado', read_only=True)
    cliente_nombre = serializers.CharField(source='placa.id_cliente.nombre', read_only=True)

    class Meta:
        model = Ticket
        fields = '__all__'

    def validate(self, data):
        espacio = data.get('id_espacio')
        if espacio and espacio.estado == 'Ocupado':
            raise serializers.ValidationError({'id_espacio': 'Este espacio ya está ocupado.'})
        placa = data.get('placa')
        if placa:
            ticket_activo = Ticket.objects.filter(placa=placa, estado='Activo').first()
            if ticket_activo:
                raise serializers.ValidationError({'placa': f'El vehículo {placa.placa} ya tiene un ticket activo (#{ticket_activo.id_ticket}).'})
        return data


class PagoSerializer(serializers.ModelSerializer):
    ticket_info = TicketSerializer(source='id_ticket', read_only=True)

    class Meta:
        model = Pago
        fields = '__all__'
