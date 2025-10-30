// Copyright 2015-present 650 Industries. All rights reserved.

package expo.modules.plugin

import org.gradle.api.Project
import org.gradle.api.invocation.Gradle
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.ExtraPropertiesExtension

internal inline fun <reified T> ExtraPropertiesExtension.safeGet(name: String): T? {
  return if (has(name)) {
    get(name) as? T
  } else {
    null
  }
}

internal fun Project.extraProperties(): ExtraPropertiesExtension =
  (this as ExtensionAware).extensions.extraProperties

internal fun Gradle.extraProperties(): ExtraPropertiesExtension =
  (this as ExtensionAware).extensions.extraProperties
