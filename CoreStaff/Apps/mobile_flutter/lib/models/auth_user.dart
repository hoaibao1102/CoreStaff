class AuthUser {
  final String id;
  final String? organizationId;
  final String email;
  final String? employeeCode;
  final String fullName;
  final String role; // 'SYSTEM_ADMIN' | 'HR' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE'
  final String status;
  final bool mustChangePassword;

  AuthUser({
    required this.id,
    this.organizationId,
    required this.email,
    this.employeeCode,
    required this.fullName,
    required this.role,
    required this.status,
    this.mustChangePassword = false,
  });

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return 'NV';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    final lastTwo = parts.sublist(parts.length - 2);
    return lastTwo.map((p) => p.substring(0, 1).toUpperCase()).join('');
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      organizationId: json['organizationId']?.toString(),
      email: json['email']?.toString() ?? '',
      employeeCode: json['employeeCode']?.toString(),
      fullName: json['fullName']?.toString() ?? 'Nhân viên',
      role: json['role']?.toString() ?? 'EMPLOYEE',
      status: json['status']?.toString() ?? 'ACTIVE',
      mustChangePassword: json['mustChangePassword'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'organizationId': organizationId,
    'email': email,
    'employeeCode': employeeCode,
    'fullName': fullName,
    'role': role,
    'status': status,
    'mustChangePassword': mustChangePassword,
  };

  AuthUser copyWith({
    String? id,
    String? organizationId,
    String? email,
    String? employeeCode,
    String? fullName,
    String? role,
    String? status,
    bool? mustChangePassword,
  }) {
    return AuthUser(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      email: email ?? this.email,
      employeeCode: employeeCode ?? this.employeeCode,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      status: status ?? this.status,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }
}
