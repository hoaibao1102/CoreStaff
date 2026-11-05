class EmployeeProfileDto {
  final String id;
  final String? fullName;
  final String employeeCode;
  final String employmentType;
  final String employmentStatus;
  final String? phone;
  final String? email;
  final String? address;
  final String? joinDate;
  final String? departmentName;
  final String? positionName;
  final String? managerName;
  final String? workplaceName;

  const EmployeeProfileDto({
    required this.id,
    this.fullName,
    required this.employeeCode,
    required this.employmentType,
    required this.employmentStatus,
    this.phone,
    this.email,
    this.address,
    this.joinDate,
    this.departmentName,
    this.positionName,
    this.managerName,
    this.workplaceName,
  });

  factory EmployeeProfileDto.fromJson(Map<String, dynamic> json) {
    return EmployeeProfileDto(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      fullName: json['fullName']?.toString(),
      employeeCode: json['employeeCode']?.toString() ?? '',
      employmentType: json['employmentType']?.toString() ?? 'FULL_TIME',
      employmentStatus: json['employmentStatus']?.toString() ?? 'ACTIVE',
      phone: json['phone']?.toString(),
      email: json['email']?.toString(),
      address: json['address']?.toString(),
      joinDate: json['joinDate']?.toString(),
      departmentName: json['departmentName']?.toString(),
      positionName: json['positionName']?.toString(),
      managerName: json['managerName']?.toString(),
      workplaceName: json['workplaceName']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'employeeCode': employeeCode,
      'employmentType': employmentType,
      'employmentStatus': employmentStatus,
      'phone': phone,
      'email': email,
      'address': address,
      'joinDate': joinDate,
      'departmentName': departmentName,
      'positionName': positionName,
      'managerName': managerName,
      'workplaceName': workplaceName,
    };
  }

  String get initials {
    final name = (fullName ?? '').trim();
    if (name.isEmpty) return 'NV';
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'NV';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[parts.length - 2].substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

