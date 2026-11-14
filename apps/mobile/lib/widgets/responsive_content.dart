import 'package:flutter/material.dart';

class ResponsiveContent extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry? padding;

  const ResponsiveContent({
    super.key,
    required this.child,
    this.maxWidth = 960,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : maxWidth;
        final horizontalPadding =
            padding ??
            EdgeInsets.symmetric(horizontal: availableWidth < 360 ? 12 : 16);
        return SizedBox(
          width: availableWidth.clamp(0.0, maxWidth).toDouble(),
          child: Padding(padding: horizontalPadding, child: child),
        );
      },
    );
  }
}
