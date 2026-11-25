import 'package:flutter/material.dart';
import '../config/api_config.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import 'history_screen.dart';
import 'profile_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  final UserModel user;
  final ValueChanged<UserModel> onUserUpdated;
  final VoidCallback onLogout;

  const ProfileScreen({
    super.key,
    required this.user,
    required this.onUserUpdated,
    required this.onLogout,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late UserModel _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
  }

  Future<void> _editIdentity() async {
    final updatedUser = await Navigator.push<UserModel>(
      context,
      MaterialPageRoute(builder: (_) => EditProfileIdentityScreen(user: _user)),
    );
    if (updatedUser != null && mounted) {
      setState(() => _user = updatedUser);
      widget.onUserUpdated(updatedUser);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Identitas berhasil diperbarui.')),
      );
    }
  }

  Future<void> _changePassword() async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
    );
    if (updated == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password berhasil diperbarui.')),
      );
    }
  }

  Future<void> _openHistory() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(builder: (_) => const HistoryScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initial = _user.name.isNotEmpty
        ? _user.name.substring(0, 1).toUpperCase()
        : 'U';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: const Text('Profil & Pengaturan'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: const Color(0xFF059669),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _user.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _user.email,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Chip(
                          visualDensity: VisualDensity.compact,
                          label: Text(_user.role.toUpperCase()),
                          avatar: const Icon(Icons.badge_outlined, size: 16),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Akun pribadi',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline_rounded),
                  title: const Text('Identitas pribadi'),
                  subtitle: const Text('Ubah nama dan lihat detail akun'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: _editIdentity,
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.lock_outline_rounded),
                  title: const Text('Ganti password'),
                  subtitle: const Text('Perbarui kata sandi akun'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: _changePassword,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Aktivitas perangkat',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.cloud_sync_outlined),
              title: const Text('Riwayat & antrean offline'),
              subtitle: const Text(
                'Periksa penerimaan tersimpan dan sinkronkan antrean',
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: _openHistory,
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.cloud_done_outlined, color: Color(0xFF16A34A)),
                      SizedBox(width: 8),
                      Text(
                        'Koneksi Cloud Baraja Store',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const SelectableText(
                    ApiConfig.defaultProduction,
                    style: TextStyle(
                      fontSize: 13,
                      fontFamily: 'monospace',
                      color: Color(0xFF0284C7),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Terhubung otomatis ke server Baraja Store.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              await AuthService.logout();
              widget.onLogout();
            },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Keluar dari akun'),
            style: OutlinedButton.styleFrom(
              foregroundColor: theme.colorScheme.error,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ],
      ),
    );
  }
}
