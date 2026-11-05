class AuthUser {
  final String id;
  final String? organizationId;
  final String email;
  final String? employeeCode;
  final String fullName;
  final String role;
  final String status;
  final bool mustChangePassword;

  const AuthUser({
    required this.id,
    this.organizationId,
    required this.email,
    this.employeeCode,
    required this.fullName,
    required this.role,
    required this.status,
    this.mustChangePassword = false,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      organizationId: json['organizationId']?.toString(),
      email: json['email']?.toString() ?? '',
      employeeCode: json['employeeCode']?.toString(),
      fullName: json['fullName']?.toString() ?? 'Nhân viên',
      role: json['role']?.toString() ?? 'EMPLOYEE',
      status: json['status']?.toString() ?? 'ACTIVE',
      mustChangePassword: json['mustChangePassword'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      if (organizationId != null) 'organizationId': organizationId,
      'email': email,
      if (employeeCode != null) 'employeeCode': employeeCode,
      'fullName': fullName,
      'role': role,
      'status': status,
      'mustChangePassword': mustChangePassword,
    };
  }

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

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'NV';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[parts.length - 2].substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  bool get isBlockedRole => role == 'HR' || role == 'SYSTEM_ADMIN';
}

class LoginResult {
  final AuthUser user;
  final bool mustChangePassword;

  const LoginResult({
    required this.user,
    required this.mustChangePassword,
  });
}

