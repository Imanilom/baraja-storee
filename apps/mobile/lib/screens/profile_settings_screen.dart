import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class EditProfileIdentityScreen extends StatefulWidget {
  final UserModel user;

  const EditProfileIdentityScreen({super.key, required this.user});

  @override
  State<EditProfileIdentityScreen> createState() =>
      _EditProfileIdentityScreenState();
}

class _EditProfileIdentityScreenState extends State<EditProfileIdentityScreen> {
  late final TextEditingController _nameController;
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user.name);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final user = await AuthService.updateProfile(
        currentUser: widget.user,
        name: _nameController.text.trim(),
      );
      if (mounted) Navigator.pop(context, user);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Identitas pribadi')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Ubah nama yang ditampilkan pada akun. Email dan peran akun dikelola oleh administrator.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nama lengkap',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Nama lengkap wajib diisi.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: widget.user.email,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: 'Email akun',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: widget.user.role,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: 'Peran akun',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          onPressed: _isSaving ? null : _save,
          icon: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.save_outlined),
          label: Text(_isSaving ? 'Menyimpan...' : 'Simpan identitas'),
        ),
      ),
    );
  }
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      await AuthService.changePassword(
        currentPassword: _currentPasswordController.text,
        newPassword: _newPasswordController.text,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ganti password')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Masukkan password saat ini, lalu buat password baru minimal 6 karakter.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _currentPasswordController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: const InputDecoration(
                    labelText: 'Password saat ini',
                    prefixIcon: Icon(Icons.lock_outline_rounded),
                  ),
                  validator: (value) => value == null || value.isEmpty
                      ? 'Password saat ini wajib diisi.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _newPasswordController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'Password baru',
                    prefixIcon: Icon(Icons.lock_reset_rounded),
                  ),
                  validator: (value) => value == null || value.length < 6
                      ? 'Password baru minimal 6 karakter.'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Ulangi password baru',
                    prefixIcon: Icon(Icons.verified_user_outlined),
                  ),
                  validator: (value) => value != _newPasswordController.text
                      ? 'Konfirmasi password belum sama.'
                      : null,
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          onPressed: _isSaving ? null : _save,
          icon: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.lock_reset_rounded),
          label: Text(_isSaving ? 'Menyimpan...' : 'Perbarui password'),
        ),
      ),
    );
  }
}
