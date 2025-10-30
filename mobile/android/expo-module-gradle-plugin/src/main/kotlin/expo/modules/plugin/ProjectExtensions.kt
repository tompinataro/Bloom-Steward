// Copyright 2015-present 650 Industries. All rights reserved.

package expo.modules.plugin

import org.gradle.api.Project
import org.gradle.api.plugins.ExtraPropertiesExtension
import org.gradle.api.plugins.ExtensionAware

internal fun Project.extraProperties(): ExtraPropertiesExtension {
  return (this as ExtensionAware).extensions.extraProperties
}
