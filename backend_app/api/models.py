from django.db import models

class Cliente(models.Model):
    id_cliente = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    tipo_cliente = models.CharField(max_length=100)

    def __str__(self):
        return self.nombre

class Vehiculo(models.Model):
    placa = models.CharField(primary_key=True, max_length=20)
    tipo = models.CharField(max_length=100)
    marca = models.CharField(max_length=100)
    color = models.CharField(max_length=50)
    id_cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="vehiculos")

    def __str__(self):
        return f"{self.placa} - {self.marca}"

class Empleado(models.Model):
    id_empleado = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200)
    rol = models.CharField(max_length=100)

    def __str__(self):
        return self.nombre

class Espacio(models.Model):
    id_espacio = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=20, unique=True)
    estado = models.CharField(max_length=50, default='Libre')
    tipo_ubicacion = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.codigo} ({self.estado})"

class Tarifa(models.Model):
    id_tarifa = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    unidad_tiempo = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.nombre} - ${self.valor}/{self.unidad_tiempo}"

class Ticket(models.Model):
    id_ticket = models.AutoField(primary_key=True)
    fecha_entrada = models.DateTimeField(auto_now_add=True)
    fecha_salida = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=50, default='Activo')
    placa = models.ForeignKey(Vehiculo, on_delete=models.CASCADE)
    id_espacio = models.ForeignKey(Espacio, on_delete=models.SET_NULL, null=True)
    id_tarifa = models.ForeignKey(Tarifa, on_delete=models.SET_NULL, null=True)
    id_empleado = models.ForeignKey(Empleado, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"Ticket #{self.id_ticket} - {self.placa.placa}"

class Pago(models.Model):
    id_pago = models.AutoField(primary_key=True)
    fecha_pago = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=100)
    id_ticket = models.OneToOneField(Ticket, on_delete=models.CASCADE, related_name='pago_factura')

    def __str__(self):
        return f"Pago #{self.id_pago} - ${self.total}"
