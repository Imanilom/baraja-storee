class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? locationId;
  final String? token;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.locationId,
    this.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? '',
      locationId: json['location_id'] is Map ? json['location_id']['_id'] : json['location_id']?.toString(),
      token: token ?? json['token'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'location_id': locationId,
      'token': token,
    };
  }
}

